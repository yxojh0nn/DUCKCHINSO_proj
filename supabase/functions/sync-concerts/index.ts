// KOPIS 공연예술통합전산망 오픈 API → concerts (docs/오픈API_조사.md 1장)
// 대중음악(CCCD) 공연 중 등록된 J-pop 아티스트 이름이 들어간 공연은 바로 게시, J-pop 같지만 아티스트를 못 찾은 공연은 검수 대기
// 예매 오픈 일시는 KOPIS 에 없어 운영자가 입력한다
import { admin, isServiceCall, json } from '../_shared/supabase.ts'
import { expandSchedule, looksJapanese, matchArtists, parseDetail, parseList, parsePrice, shortRegion } from '../_shared/kopis.ts'

const BASE = 'http://www.kopis.or.kr/openApi/restful'
const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')

Deno.serve(async (req) => {
  if (!isServiceCall(req)) return json({ error: 'forbidden' }, 403)
  const key = Deno.env.get('KOPIS_API_KEY')
  if (!key) return json({ error: 'KOPIS_API_KEY missing' }, 500)
  const db = admin()

  const { data: artistRows } = await db.from('artists').select('id, name, name_ja, name_en, aliases')
  const artists = (artistRows ?? []).map((a) => ({
    id: a.id as string, names: [a.name, a.name_ja, a.name_en, ...(a.aliases ?? [])].filter(Boolean) as string[],
  }))

  // 오늘부터 6개월 뒤까지 시작하는 공연
  const st = new Date()
  const ed = new Date(st.getTime() + 183 * 86_400_000)
  const found = []
  for (let page = 1; page <= 20; page++) {
    const res = await fetch(`${BASE}/pblprfr?service=${key}&stdate=${ymd(st)}&eddate=${ymd(ed)}&cpage=${page}&rows=100&shcate=CCCD`)
    const items = parseList(await res.text())
    found.push(...items)
    if (items.length < 100) break
  }

  let published = 0, review = 0
  for (const item of found) {
    const hit = matchArtists(item.title, artists)
    if (!hit.length && !looksJapanese(item.title)) continue

    const d = parseDetail(await (await fetch(`${BASE}/pblprfr/${item.id}?service=${key}`)).text())
    const artistIds = [...new Set([...hit, ...matchArtists(d.cast, artists)])]
    const [priceMin, priceMax] = parsePrice(d.priceText)
    const schedules = expandSchedule(d.from, d.to, d.schedule)

    // 운영자가 이미 손본 공연(source=admin)이나 숨긴 공연은 상태를 덮어쓰지 않는다
    const { data: existing } = await db.from('concerts').select('id, status, source').eq('kopis_id', d.id).maybeSingle()
    const status = existing?.status === 'hidden' ? 'hidden' : artistIds.length ? 'published' : (existing?.status ?? 'review')
    const row = {
      kopis_id: d.id, title: d.title, poster_url: d.poster || null, venue_name: d.venue, venue_query: d.venue,
      region: shortRegion(d.area), price_text: d.priceText || null, price_min: priceMin, price_max: priceMax,
      status, source: existing?.source ?? 'kopis', last_date: d.to, updated_at: new Date().toISOString(),
    }
    const { data: saved, error } = await db.from('concerts').upsert(row, { onConflict: 'kopis_id' }).select('id').single()
    if (error || !saved) continue

    await db.from('concert_schedules').delete().eq('concert_id', saved.id)
    if (schedules.length)
      await db.from('concert_schedules').insert(schedules.map((s) => ({ concert_id: saved.id, starts_at: `${s}:00+09:00` })))
    if (artistIds.length)
      await db.from('concert_artists').upsert(artistIds.map((a) => ({ concert_id: saved.id, artist_id: a })))
    if (d.links.length)
      await db.from('ticket_links').upsert(d.links.map((l) => ({ concert_id: saved.id, vendor: l.vendor, url: l.url })))

    if (status === 'published') published++
    else review++
  }
  return json({ scanned: found.length, published, review })
})
