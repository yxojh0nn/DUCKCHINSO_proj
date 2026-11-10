// node --experimental-strip-types supabase/functions/_shared/kopis.test.ts
import assert from 'node:assert/strict'
import { cleanVenue, expandSchedule, judgeConcert, parseDetail, parsePrice, shortRegion } from './kopis.ts'

assert.deepEqual(parsePrice('VIP석 154,000원, R석 132,000원'), [132000, 154000])
assert.deepEqual(parsePrice('전석무료'), [null, null])

assert.deepEqual(expandSchedule('2026-11-14', '2026-11-15', '토요일(18:00), 일요일(17:00)'),
  ['2026-11-14T18:00', '2026-11-15T17:00'])
assert.deepEqual(expandSchedule('2026-11-17', '2026-11-22', '화요일 ~ 금요일(20:00), 토요일 ~ 일요일(15:00,19:00)').length, 8)
assert.deepEqual(expandSchedule('2026-11-14', '2026-11-14', '공연 시간 문의'), ['2026-11-14T19:00'])

// 판별 규칙 (실데이터 채점은 scripts/judge.test.ts)
const judge = (title: string, artists: { id: string; names: string[] }[], o: { cast?: string; visit?: boolean; area?: string } = {}) =>
  judgeConcert({ title, cast: o.cast ?? '', visit: o.visit ?? false, promoter: '', area: o.area ?? '서울특별시' }, artists)
const artists = [{ id: 'yoa', names: ['YOASOBI', '요아소비'] }, { id: 'kg', names: ['King Gnu', '킹누'] }]
assert.deepEqual(judge('요아소비 아시아 투어 인 서울', artists, { visit: true }).artistIds, ['yoa'])
assert.equal(judge('KING GNU Live in Seoul', artists, { visit: true }).decision, 'publish')
assert.equal(judge('어느 국내 밴드 콘서트', artists).decision, 'skip')
// 영문 이름은 단어 단위로만, 전각·곡선 따옴표도 영문 규칙으로
const short = [{ id: 'eve', names: ['Eve'] }, { id: 'b', names: ['ＢＥＧＩＮ'] }, { id: 'm', names: ['Mu’s'] }]
for (const t of ['MIERE Release Event', '#1 EXEX BEGINS', 'CLOVER MUSIC STATION']) assert.deepEqual(judge(t, short, { visit: true }).artistIds, [], t)
// 출연진에 다른 사람이 적힌 짧은 영문 이름(AFTERGLOW, LISA ONO)은 게시하지 않는다
const ag = [{ id: 'ag', names: ['Afterglow'] }, { id: 'lisa', names: ['LiSA'] }]
assert.equal(judge('하동균 단독 콘서트: AFTERGLOW', ag, { cast: '하동균' }).decision, 'skip')
assert.notEqual(judge('LISA ONO 내한공연', ag, { cast: '리사 오노, 에릭 미야시로', visit: true }).decision, 'publish')
// 출연진 정확 일치 + 내한이면 게시, 해외 공연은 제외
assert.equal(judge('요네즈 켄시 내한공연', [{ id: 'y', names: ['요네즈 켄시'] }], { cast: '요네즈 켄시', visit: true }).decision, 'publish')
assert.equal(judge('YOASOBI LIVE [일본 도쿄]', artists).decision, 'skip')
// 이름 순서가 반대로 등록돼 있어도 같은 사람 (MusicBrainz 켄시 요네즈 ↔ KOPIS 요네즈 켄시)
assert.equal(judge('요네즈 켄시 내한공연', [{ id: 'y', names: ['켄시 요네즈', 'Kenshi Yonezu'] }], { cast: '요네즈 켄시', visit: true }).decision, 'publish')

assert.equal(cleanVenue('예스24 라이브홀 (구. 악스코리아) (예스24 라이브홀 (구. 악스코리아))'), '예스24 라이브홀 (구. 악스코리아)')
assert.equal(cleanVenue('롤링홀 (롤링홀)'), '롤링홀')
assert.equal(cleanVenue('인스파이어 엔터테인먼트 리조트 (아레나)'), '인스파이어 엔터테인먼트 리조트 (아레나)')
assert.equal(shortRegion('서울특별시'), '서울')
assert.equal(shortRegion('전라북도'), '전북')
assert.equal(shortRegion('경기도'), '경기')

const d = parseDetail(`<dbs><db><mt20id>PF1</mt20id><prfnm><![CDATA[YOASOBI & Friends]]></prfnm><prfpdfrom>2026.11.14</prfpdfrom>
<prfpdto>2026.11.15</prfpdto><fcltynm>KSPO DOME</fcltynm><pcseguidance>전석 99,000원</pcseguidance>
<relates><relate><relatenm>NOL티켓</relatenm><relateurl>https://nol.example/1</relateurl></relate></relates></db></dbs>`)
assert.equal(d.title, 'YOASOBI & Friends')
assert.equal(d.from, '2026-11-14')
assert.deepEqual(d.links, [{ vendor: 'NOL티켓', url: 'https://nol.example/1' }])
console.log('kopis ok')
