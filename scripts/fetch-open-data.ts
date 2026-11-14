// pnpm fetch:opendata — 무료 오픈 API(MusicBrainz, KOPIS)로 실제 아티스트·공연을 받아 src/api/openData.json 에 저장
// 데모 모드(Supabase 미연결)가 이 파일을 읽는다. 실서비스는 같은 규칙의 Edge Function(sync-artists, sync-concerts)을 쓴다
// KOPIS_API_KEY 는 .env 에서만 읽는다 (VITE_ 접두사가 없어 앱 번들에는 들어가지 않는다)
import { writeFileSync } from 'node:fs'
import { ARTISTS } from '../src/api/demoData.ts'
import { isCandidate, judgeConcert } from '../supabase/functions/_shared/kopis.ts'
import { fetchDetail, fetchListPage } from '../supabase/functions/_shared/concerts.ts'
import { MB_USER_AGENT, mbPages, type MbArtist } from '../supabase/functions/_shared/musicbrainz.ts'
import { fromMusicBrainz, mergeArtists, toConcert } from './openData.ts'

const OUT = new URL('../src/api/openData.json', import.meta.url)
const UA = process.env.MUSICBRAINZ_USER_AGENT || MB_USER_AGENT

// 1) MusicBrainz: j-pop·j-rock 태그의 일본 아티스트 (초당 1회 이하, User-Agent 필수)
const mb: MbArtist[] = []
for await (const r of mbPages(UA, 5, 1)) {
  if (!r.ok) { console.warn(`MusicBrainz ${r.tag} ${r.page}: HTTP ${r.status}`); continue } // 그 태그는 mbPages 가 그만 받는다
  mb.push(...r.artists)
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
    const { ok, status, items } = await fetchListPage(key, st, ed, page)
    // 중간에 끊긴 목록으로 기존 파일을 덮어쓰지 않는다
    if (!ok) { console.error(`KOPIS 목록 ${page}쪽 실패(HTTP ${status}). 저장하지 않고 끝냄`); process.exit(1) }
    found.push(...items)
    if (items.length < 100) break
  }
  for (const item of found) {
    if (!isCandidate(item.title, artists)) continue
    const d = await fetchDetail(key, item.id)
    if (!d) { console.warn(`  상세 못 받음: ${item.title}`); continue }
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
