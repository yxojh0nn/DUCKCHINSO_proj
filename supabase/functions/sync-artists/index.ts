// MusicBrainz → artists. 검색·이름 규칙은 _shared/musicbrainz.ts (scripts 와 공용)
import { admin, isServiceCall, json } from '../_shared/supabase.ts'
import { MB_USER_AGENT, mbNames, mbPages } from '../_shared/musicbrainz.ts'

const UA = Deno.env.get('MUSICBRAINZ_USER_AGENT') ?? MB_USER_AGENT

Deno.serve(async (req) => {
  if (!(await isServiceCall(req))) return json({ error: 'forbidden' }, 403)
  const db = admin()
  const pages = Number(new URL(req.url).searchParams.get('pages') ?? 5)
  let saved = 0

  for await (const { ok, artists } of mbPages(UA, pages, 2)) {
    if (!ok) continue // 그 태그는 mbPages 가 그만 받는다
    const rows = artists.map((a) => {
      const { ko, ja, en } = mbNames(a)
      return {
        mbid: a.id, name: ko ?? a.name, name_ja: ja, name_en: en, source: 'musicbrainz',
        aliases: [...new Set((a.aliases ?? []).map((x) => x.name))].slice(0, 20),
      }
    })
    // 운영자가 고친 이름(source=admin)은 덮어쓰지 않도록 musicbrainz 행만 갱신
    const { data: adminRows } = await db.from('artists').select('mbid').eq('source', 'admin').in('mbid', rows.map((r) => r.mbid))
    const locked = new Set((adminRows ?? []).map((r) => r.mbid))
    const fresh = rows.filter((r) => !locked.has(r.mbid))
    if (fresh.length) {
      const { error } = await db.from('artists').upsert(fresh, { onConflict: 'mbid' })
      if (!error) saved += fresh.length
    }
  }
  return json({ saved })
})
