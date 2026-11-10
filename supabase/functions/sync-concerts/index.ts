// KOPIS 공연예술통합전산망 오픈 API → concerts (docs/오픈API_조사.md 1장)
// 대중음악(CCCD) 공연을 judgeConcert(점수제)로 판별: 4점 이상 게시, 2~3점과 아티스트 미등록 일본 내한 공연은 검수 대기
// 예매 오픈 일시는 KOPIS 에 없어 운영자가 입력한다
import { admin, isServiceCall, json } from '../_shared/supabase.ts'
import { isCandidate, judgeConcert, parseList } from '../_shared/kopis.ts'
import { fetchDetail, KOPIS_BASE as BASE, loadArtists, loadPromoters, saveConcert } from '../_shared/concerts.ts'

const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')

Deno.serve(async (req) => {
  if (!(await isServiceCall(req))) return json({ error: 'forbidden' }, 403)
  const key = Deno.env.get('KOPIS_API_KEY')
  if (!key) return json({ error: 'KOPIS_API_KEY missing' }, 500)
  const db = admin()

  const [artists, promoters] = await Promise.all([loadArtists(db), loadPromoters(db)])

  // 한 번에 목록 3쪽(300건)만: KOPIS 가 연속 요청을 막아 재시도가 길어지면 함수 실행 한도(150초)를 넘는다.
  // 정기 작업이 from=1,4,7 로 10분 간격 세 번 부른다 (20261104000005_split_concert_sync.sql)
  const params = new URL(req.url).searchParams
  const from = Math.max(1, Number(params.get('from') ?? 1))
  const pages = Math.min(5, Math.max(1, Number(params.get('pages') ?? 3)))

  // 오늘부터 6개월 뒤까지 시작하는 공연
  const st = new Date()
  const ed = new Date(st.getTime() + 183 * 86_400_000)
  const found = []
  let more = false
  for (let page = from; page < from + pages; page++) {
    // 연속 요청은 KOPIS 가 막는다(빈 응답·HTTP 400): 점점 길게 쉬며 세 번까지 다시
    let xml = ''
    for (const wait of [300, 3000, 6000, 10000]) {
      await new Promise((r) => setTimeout(r, wait))
      const res = await fetch(`${BASE}/pblprfr?service=${key}&stdate=${ymd(st)}&eddate=${ymd(ed)}&cpage=${page}&rows=100&shcate=CCCD`)
      xml = await res.text()
      if (res.ok && /<dbs/.test(xml) && !/<returncode>/.test(xml)) break
    }
    const items = parseList(xml)
    found.push(...items)
    more = items.length === 100
    if (!more) break
  }

  // 받은 목록은 전부 kopis_inbox 에 남긴다: 후보에도 못 오른 공연을 운영자가 '공연 찾기'에서 검색해 가져올 수 있게
  if (found.length)
    await db.from('kopis_inbox').upsert(found.map((it) => ({
      kopis_id: it.id, title: it.title, venue: it.venue, area: it.area, poster_url: it.poster || null,
      start_date: it.from || null, end_date: it.to || null, seen_at: new Date().toISOString(),
    })), { onConflict: 'kopis_id' })

  let published = 0, review = 0
  for (const item of found) {
    if (!isCandidate(item.title, artists)) continue
    const d = await fetchDetail(key, item.id)
    if (!d) continue
    const verdict = judgeConcert(d, artists, promoters)
    if (verdict.decision === 'skip') continue
    const saved = await saveConcert(db, d, verdict, 'auto')
    if (!saved) continue
    if (saved.status === 'published') published++
    else review++
  }
  return json({ from, scanned: found.length, published, review, more })
})
