// node --experimental-strip-types supabase/functions/_shared/kopis.test.ts
import assert from 'node:assert/strict'
import { expandSchedule, matchArtists, parseDetail, parsePrice, shortRegion } from './kopis.ts'

assert.deepEqual(parsePrice('VIP석 154,000원, R석 132,000원'), [132000, 154000])
assert.deepEqual(parsePrice('전석무료'), [null, null])

assert.deepEqual(expandSchedule('2026-11-14', '2026-11-15', '토요일(18:00), 일요일(17:00)'),
  ['2026-11-14T18:00', '2026-11-15T17:00'])
assert.deepEqual(expandSchedule('2026-11-17', '2026-11-22', '화요일 ~ 금요일(20:00), 토요일 ~ 일요일(15:00,19:00)').length, 8)
assert.deepEqual(expandSchedule('2026-11-14', '2026-11-14', '공연 시간 문의'), ['2026-11-14T19:00'])

const artists = [{ id: 'yoa', names: ['YOASOBI', '요아소비'] }, { id: 'kg', names: ['King Gnu', '킹누'] }]
assert.deepEqual(matchArtists('요아소비 아시아 투어 인 서울', artists), ['yoa'])
assert.deepEqual(matchArtists('KING GNU Live', artists), ['kg'])
assert.deepEqual(matchArtists('어느 국내 밴드 콘서트', artists), [])

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
