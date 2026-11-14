// KOPIS 공연을 DB 에 저장하는 공통 부분 (sync-concerts 정기 수집, import-concert 운영자 가져오기)
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0'
import { type ArtistKey, expandSchedule, JPOP_PROMOTERS, type KopisDetail, parseDetail, parseList, parsePrice, shortRegion, type Verdict } from './kopis.ts'
import { sleep, ymd } from './time.ts'

export const KOPIS_BASE = 'http://www.kopis.or.kr/openApi/restful'

// 대중음악(CCCD) 목록 한 쪽(100건). 연속 요청은 KOPIS 가 막는다(빈 응답·HTTP 400): 점점 길게 쉬며 세 번까지 다시
// 실패해도 마지막 응답에서 읽은 항목을 돌려준다 (ok 로 성공 여부를 알린다)
export async function fetchListPage(key: string, st: Date, ed: Date, page: number) {
  let res: Response | undefined, xml = ''
  for (const wait of [300, 3000, 6000, 10000]) {
    await sleep(wait)
    res = await fetch(`${KOPIS_BASE}/pblprfr?service=${key}&stdate=${ymd(st)}&eddate=${ymd(ed)}&cpage=${page}&rows=100&shcate=CCCD`)
    xml = await res.text()
    if (res.ok && /<dbs/.test(xml) && !/<returncode>/.test(xml)) return { ok: true, status: res.status, items: parseList(xml) }
  }
  return { ok: false, status: res?.status ?? 0, items: parseList(xml) }
}

// 연달아 부르면 KOPIS 가 빈 응답을 준다: 간격을 두고, 비어 있으면 두 번까지 다시
export async function fetchDetail(key: string, kopisId: string): Promise<KopisDetail | null> {
  let d = parseDetail('')
  for (let i = 0; i < 3 && !d.id; i++) {
    await sleep(i ? 1500 : 250)
    d = parseDetail(await (await fetch(`${KOPIS_BASE}/pblprfr/${encodeURIComponent(kopisId)}?service=${key}`)).text())
  }
  return d.id ? d : null
}

export async function loadArtists(db: SupabaseClient): Promise<ArtistKey[]> {
  // shortcut: 한 번에 최대 5000명. 아티스트가 그보다 많아지면 나눠 읽는다
  const { data } = await db.from('artists').select('id, name, name_ja, name_en, aliases').range(0, 4999)
  return (data ?? []).map((a) => ({
    id: a.id as string, names: [a.name, a.name_ja, a.name_en, ...(a.aliases ?? [])].filter(Boolean) as string[],
  }))
}

export async function loadPromoters(db: SupabaseClient): Promise<string[]> {
  const { data } = await db.from('jpop_promoters').select('name')
  return data?.length ? data.map((r) => r.name as string) : JPOP_PROMOTERS
}

// 공연 저장. 운영자가 숨긴 공연은 숨김 그대로, 운영자가 손본 공연(source=admin)은 출처를 덮어쓰지 않는다
export async function saveConcert(db: SupabaseClient, d: KopisDetail, verdict: Verdict, wanted: 'auto' | 'review') {
  const [priceMin, priceMax] = parsePrice(d.priceText)
  const schedules = expandSchedule(d.from, d.to, d.schedule)
  const { data: existing } = await db.from('concerts').select('id, status, source').eq('kopis_id', d.id).maybeSingle()
  const status = existing?.status === 'hidden' ? 'hidden'
    : wanted === 'auto' && verdict.decision === 'publish' ? 'published' : (existing?.status ?? 'review')
  const row = {
    kopis_id: d.id, title: d.title, poster_url: d.poster || null, venue_name: d.venue, venue_query: d.venue,
    region: shortRegion(d.area), price_text: d.priceText || null, price_min: priceMin, price_max: priceMax,
    status, source: existing?.source ?? 'kopis', last_date: d.to, updated_at: new Date().toISOString(),
    review_score: verdict.score, review_reasons: verdict.reasons, visit: d.visit, cast_text: d.cast || null, promoter: d.promoter || null,
    intro_urls: d.intro,
  }
  const { data: saved, error } = await db.from('concerts').upsert(row, { onConflict: 'kopis_id' }).select('id, status').single()
  if (error || !saved) return null

  await db.from('concert_schedules').delete().eq('concert_id', saved.id)
  if (schedules.length)
    await db.from('concert_schedules').insert(schedules.map((s) => ({ concert_id: saved.id, starts_at: `${s}:00+09:00` })))
  if (verdict.artistIds.length)
    await db.from('concert_artists').upsert(verdict.artistIds.map((a) => ({ concert_id: saved.id, artist_id: a })))
  if (d.links.length)
    await db.from('ticket_links').upsert(d.links.map((l) => ({ concert_id: saved.id, vendor: l.vendor, url: l.url })))
  return saved as { id: string; status: string }
}
