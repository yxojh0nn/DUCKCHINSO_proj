// pnpm dump:kopis — 판별 규칙 보정용 정답 데이터의 원본을 받는다 (scripts/fixtures/kopis-candidates.json)
// 후보를 넓게 잡는다: 공연명에 아티스트 이름이 글자 그대로 들어 있거나(3글자 이상), 일본·내한 표시가 있는 공연
import { mkdirSync, writeFileSync } from 'node:fs'
import { ARTISTS } from '../src/api/demoData.ts'
import { isCandidate, norm, parseDetail, parseList } from '../supabase/functions/_shared/kopis.ts'
import { fromMusicBrainz, mergeArtists, type MbArtist } from './openData.ts'

const key = process.env.KOPIS_API_KEY
if (!key) { console.error('.env 에 KOPIS_API_KEY 필요'); process.exit(1) }
const UA = process.env.MUSICBRAINZ_USER_AGENT || 'Duckchinso/0.1 ( https://github.com/Yeojh3261/DUCKCHINSO_proj )'
const KOPIS = 'http://www.kopis.or.kr/openApi/restful'
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')

const mb: MbArtist[] = []
for (const tagName of ['j-pop', 'j-rock']) {
  for (let page = 0; page < 5; page++) {
    const q = encodeURIComponent(`tag:"${tagName}" AND country:JP`)
    const get = () => fetch(`https://musicbrainz.org/ws/2/artist?query=${q}&fmt=json&limit=100&offset=${page * 100}`, { headers: { 'User-Agent': UA, Accept: 'application/json' } })
    let res = await get()
    if (res.status === 503) { await sleep(3000); res = await get() }
    if (!res.ok) { console.error(`MusicBrainz 실패 HTTP ${res.status}`); process.exit(1) }
    const { artists = [] } = (await res.json()) as { artists: MbArtist[] }
    mb.push(...artists)
    await sleep(1100)
    if (artists.length < 100) break
  }
}
const artists = mergeArtists(ARTISTS, [...new Map(mb.map((a) => [a.id, fromMusicBrainz(a)])).values()])

const st = new Date(), ed = new Date(st.getTime() + 183 * 86_400_000)
const found = []
for (let page = 1; page <= 20; page++) {
  let xml = ''
  for (let i = 0; i < 3; i++) {
    await sleep(i ? 3000 : 300)
    xml = await (await fetch(`${KOPIS}/pblprfr?service=${key}&stdate=${ymd(st)}&eddate=${ymd(ed)}&cpage=${page}&rows=100&shcate=CCCD`)).text()
    if (!/<returncode>/.test(xml) && /<dbs/.test(xml)) break
  }
  const items = parseList(xml)
  found.push(...items)
  if (items.length < 100) break
}
const loose = (text: string) => artists.filter((a) => a.names.some((n) => norm(n).length >= 3 && norm(text).includes(norm(n))))
const items = [], used = new Map<string, (typeof artists)[number]>()
for (const it of found) {
  if (!isCandidate(it.title, artists)) continue
  const hits = loose(it.title)
  let d = parseDetail('')
  for (let i = 0; i < 3 && !d.id; i++) {
    await sleep(i ? 1500 : 250)
    d = parseDetail(await (await fetch(`${KOPIS}/pblprfr/${it.id}?service=${key}`)).text())
  }
  if (!d.id) continue
  for (const a of [...hits, ...loose(d.cast)]) used.set(a.id, a)
  items.push({ id: d.id, title: d.title, cast: d.cast, visit: d.visit, promoter: d.promoter, area: d.area })
}
mkdirSync(new URL('./fixtures/', import.meta.url), { recursive: true })
writeFileSync(new URL('./fixtures/kopis-candidates.json', import.meta.url),
  JSON.stringify({ fetchedAt: new Date().toISOString(), scanned: found.length, artists: [...used.values()], items }, null, 1) + '\n')
console.log(`대중음악 ${found.length}건 → 후보 ${items.length}건, 관련 아티스트 ${used.size}명 저장`)
