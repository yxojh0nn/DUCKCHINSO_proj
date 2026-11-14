// pnpm dump:kopis — 판별 규칙 보정용 정답 데이터의 원본을 받는다 (scripts/fixtures/kopis-candidates.json)
// 후보를 넓게 잡는다: 공연명에 아티스트 이름이 글자 그대로 들어 있거나(3글자 이상), 일본·내한 표시가 있는 공연
import { mkdirSync, writeFileSync } from 'node:fs'
import { ARTISTS } from '../src/api/demoData.ts'
import { isCandidate, norm } from '../supabase/functions/_shared/kopis.ts'
import { fetchDetail, fetchListPage } from '../supabase/functions/_shared/concerts.ts'
import { MB_USER_AGENT, mbPages, type MbArtist } from '../supabase/functions/_shared/musicbrainz.ts'
import { fromMusicBrainz, mergeArtists } from './openData.ts'

const key = process.env.KOPIS_API_KEY
if (!key) { console.error('.env 에 KOPIS_API_KEY 필요'); process.exit(1) }
const UA = process.env.MUSICBRAINZ_USER_AGENT || MB_USER_AGENT

const mb: MbArtist[] = []
for await (const r of mbPages(UA, 5, 1)) {
  if (!r.ok) { console.error(`MusicBrainz 실패 HTTP ${r.status}`); process.exit(1) }
  mb.push(...r.artists)
}
const artists = mergeArtists(ARTISTS, [...new Map(mb.map((a) => [a.id, fromMusicBrainz(a)])).values()])

const st = new Date(), ed = new Date(st.getTime() + 183 * 86_400_000)
const found = []
for (let page = 1; page <= 20; page++) {
  const { items } = await fetchListPage(key, st, ed, page)
  found.push(...items)
  if (items.length < 100) break
}
const loose = (text: string) => artists.filter((a) => a.names.some((n) => norm(n).length >= 3 && norm(text).includes(norm(n))))
const items = [], used = new Map<string, (typeof artists)[number]>()
for (const it of found) {
  if (!isCandidate(it.title, artists)) continue
  const hits = loose(it.title)
  const d = await fetchDetail(key, it.id)
  if (!d) continue
  for (const a of [...hits, ...loose(d.cast)]) used.set(a.id, a)
  items.push({ id: d.id, title: d.title, cast: d.cast, visit: d.visit, promoter: d.promoter, area: d.area })
}
mkdirSync(new URL('./fixtures/', import.meta.url), { recursive: true })
writeFileSync(new URL('./fixtures/kopis-candidates.json', import.meta.url),
  JSON.stringify({ fetchedAt: new Date().toISOString(), scanned: found.length, artists: [...used.values()], items }, null, 1) + '\n')
console.log(`대중음악 ${found.length}건 → 후보 ${items.length}건, 관련 아티스트 ${used.size}명 저장`)
