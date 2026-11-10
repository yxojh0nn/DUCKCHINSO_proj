// pnpm fetch:opendata — 무료 오픈 API(MusicBrainz, KOPIS)로 실제 아티스트·공연을 받아 src/api/openData.json 에 저장
// 데모 모드(Supabase 미연결)가 이 파일을 읽는다. 실서비스는 같은 규칙의 Edge Function(sync-artists, sync-concerts)을 쓴다
// KOPIS_API_KEY 는 .env 에서만 읽는다 (VITE_ 접두사가 없어 앱 번들에는 들어가지 않는다)
import { writeFileSync } from 'node:fs'
import { ARTISTS } from '../src/api/demoData.ts'
import { isCandidate, judgeConcert, parseDetail, parseList } from '../supabase/functions/_shared/kopis.ts'
import { fromMusicBrainz, mergeArtists, toConcert, type MbArtist } from './openData.ts'

const OUT = new URL('../src/api/openData.json', import.meta.url)
const KOPIS = 'http://www.kopis.or.kr/openApi/restful'
const UA = process.env.MUSICBRAINZ_USER_AGENT || 'Duckchinso/0.1 ( https://github.com/Yeojh3261/DUCKCHINSO_proj )'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')

// 1) MusicBrainz: j-pop·j-rock 태그의 일본 아티스트 (초당 1회 이하, User-Agent 필수)
const mb: MbArtist[] = []
for (const tagName of ['j-pop', 'j-rock']) {
  for (let page = 0; page < 5; page++) {
    const q = encodeURIComponent(`tag:"${tagName}" AND country:JP`)
    const get = () => fetch(`https://musicbrainz.org/ws/2/artist?query=${q}&fmt=json&limit=100&offset=${page * 100}`, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
    })
    let res = await get()
    if (res.status === 503) { await sleep(3000); res = await get() } // 요청이 몰리면 잠깐 막는다: 한 번만 다시 시도
    if (!res.ok) { console.warn(`MusicBrainz ${tagName} ${page}: HTTP ${res.status}`); break }
    const { artists = [] } = (await res.json()) as { artists: MbArtist[] }
    mb.push(...artists)
    await sleep(1100)
    if (artists.length < 100) break
  }
}
const artists = mergeArtists(ARTISTS, [...new Map(mb.map((a) => [a.id, fromMusicBrainz(a)])).values()])
console.log(`MusicBrainz: ${mb.length}명 받음 → 대조용 ${artists.length}명`)

// 2) KOPIS: 대중음악(CCCD), 오늘~6개월. sync-concerts 와 같은 판별(judgeConcert 점수제). 데모에는 운영자가 없어 검수 대기는 넣지 않는다
const key = process.env.KOPIS_API_KEY
const concerts = []
let review = 0
if (!key) {
  console.log('KOPIS_API_KEY 가 .env 에 없어 공연 수집은 건너뜀 (데모 샘플 공연 유지)')
} else {
  const st = new Date()
  const ed = new Date(st.getTime() + 183 * 86_400_000)
  const found = []
  for (let page = 1; page <= 20; page++) {
    let res: Response | null = null, xml = ''
    for (let i = 0; i < 3; i++) {
      await sleep(i ? 3000 : 300)
      res = await fetch(`${KOPIS}/pblprfr?service=${key}&stdate=${ymd(st)}&eddate=${ymd(ed)}&cpage=${page}&rows=100&shcate=CCCD`)
      xml = await res.text()
      if (res.ok && !/<returncode>/.test(xml)) break
    }
    // 중간에 끊긴 목록으로 기존 파일을 덮어쓰지 않는다
    if (!res!.ok || /<returncode>/.test(xml)) { console.error(`KOPIS 목록 ${page}쪽 실패(HTTP ${res!.status}). 저장하지 않고 끝냄`); process.exit(1) }
    const items = parseList(xml)
    found.push(...items)
    if (items.length < 100) break
  }
  for (const item of found) {
    if (!isCandidate(item.title, artists)) continue
    // 연달아 부르면 KOPIS 가 빈 응답을 준다: 간격을 두고, 비어 있으면 두 번까지 다시
    let d = parseDetail('')
    for (let i = 0; i < 3 && !d.id; i++) {
      await sleep(i ? 1500 : 250)
      d = parseDetail(await (await fetch(`${KOPIS}/pblprfr/${item.id}?service=${key}`)).text())
    }
    if (!d.id) { console.warn(`  상세 못 받음: ${item.title}`); continue }
    const v = judgeConcert(d, artists)
    if (v.decision === 'skip') continue
    console.log(`  ${v.decision === 'publish' ? '게시' : '검수 대기'} ${v.score}점: ${d.title} (${v.reasons.join(', ')})`)
    if (v.decision === 'review') { review++; continue }
    const c = toConcert(d, v.artistIds)
    if (c.schedules.length) concerts.push(c)
  }
  console.log(`KOPIS: 대중음악 ${found.length}건 중 J-pop 게시 ${concerts.length}건, 검수 대기(제외) ${review}건`)
}

// 앱에는 공연에 나온 아티스트 + 데모 아티스트만 넣는다 (shortcut: 아티스트 목록이 수백 명이면 고르기 화면이 길어짐, 인기순 정렬 생기면 확대)
const used = new Set(concerts.flatMap((c) => c.artistIds))
const keep = artists.filter((a) => !a.id.startsWith('mb:') || used.has(a.id)).map(({ names: _n, ...a }) => a)

writeFileSync(OUT, JSON.stringify({ fetchedAt: new Date().toISOString(), artists: keep, concerts }, null, 1) + '\n')
console.log(`저장: src/api/openData.json (아티스트 ${keep.length}명, 공연 ${concerts.length}건)`)
