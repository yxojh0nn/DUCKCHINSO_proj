// MusicBrainz(무료·CC0 데이터) → artists (docs/오픈API_조사.md 2장)
// 이용 규칙: 초당 1회 이하 요청, 연락처가 담긴 User-Agent 필수
import { admin, isServiceCall, json } from '../_shared/supabase.ts'

type MbAlias = { name: string; locale?: string | null; primary?: boolean | null }
type MbArtist = { id: string; name: string; score: number; country?: string; aliases?: MbAlias[] }

const UA = Deno.env.get('MUSICBRAINZ_USER_AGENT') ?? 'Duckchinso/0.1 ( contact@duckchinso.app )'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const pick = (aliases: MbAlias[] = [], locale: string) =>
  aliases.find((a) => a.locale === locale && a.primary)?.name ?? aliases.find((a) => a.locale === locale)?.name ?? null

Deno.serve(async (req) => {
  if (!isServiceCall(req)) return json({ error: 'forbidden' }, 403)
  const db = admin()
  const pages = Number(new URL(req.url).searchParams.get('pages') ?? 5)
  let saved = 0

  for (const tagName of ['j-pop', 'j-rock']) {
    for (let page = 0; page < pages; page++) {
      const q = encodeURIComponent(`tag:"${tagName}" AND country:JP`)
      const res = await fetch(`https://musicbrainz.org/ws/2/artist?query=${q}&fmt=json&limit=100&offset=${page * 100}`, {
        headers: { 'User-Agent': UA, Accept: 'application/json' },
      })
      if (!res.ok) break
      const { artists = [] } = (await res.json()) as { artists: MbArtist[] }
      const rows = artists.map((a) => {
        // 한국어 별칭은 locale 없이 등록된 경우가 많아 한글이 들어간 별칭도 쓴다
        const ko = pick(a.aliases, 'ko') ?? a.aliases?.find((x) => /[가-힣]/.test(x.name))?.name ?? null
        const ja = pick(a.aliases, 'ja') ?? (/[぀-ヿ一-鿿]/.test(a.name) ? a.name : null)
        const en = pick(a.aliases, 'en') ?? (/^[\x20-\x7e]+$/.test(a.name) ? a.name : null)
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
      await sleep(1100)
      if (artists.length < 100) break
    }
  }
  return json({ saved })
})
