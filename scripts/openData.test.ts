// node --experimental-strip-types scripts/openData.test.ts
import assert from 'node:assert/strict'
import { fromMusicBrainz, mergeArtists, toConcert } from './openData.ts'

const yoa = fromMusicBrainz({ id: 'x1', name: 'YOASOBI', aliases: [{ name: '요아소비' }, { name: 'ヨアソビ', locale: 'ja' }] })
assert.equal(yoa.name, '요아소비')
assert.equal(yoa.nameJa, 'ヨアソビ')
assert.equal(yoa.nameEn, 'YOASOBI')

// 데모 아티스트와 같은 사람이면 id 를 유지하고 별칭만 합친다. 처음 보는 아티스트는 mb: id 로 추가
const other = fromMusicBrainz({ id: 'x2', name: 'Creepy Nuts' })
const merged = mergeArtists([{ id: 'a1', name: '요아소비', nameJa: null, nameEn: 'YOASOBI' }], [yoa, other])
assert.deepEqual(merged.map((a) => a.id), ['a1', 'mb:x2'])
assert.ok(merged[0].names.includes('ヨアソビ'))

const c = toConcert({
  id: 'PF1', title: '요아소비 내한', from: '2026-12-05', to: '2026-12-06', venue: '고척스카이돔', poster: 'http://www.kopis.or.kr/p.gif',
  area: '서울특별시', cast: '', priceText: 'R석 154,000원, S석 132,000원', schedule: '토요일(18:00), 일요일(17:00)',
  links: [{ vendor: 'NOL', url: 'https://example.com' }], visit: true, promoter: '',
}, ['a1'])
assert.equal(c.id, 'kopis:PF1')
assert.equal(c.posterUrl, 'https://www.kopis.or.kr/p.gif')
assert.equal(c.region, '서울')
assert.deepEqual([c.priceMin, c.priceMax], [132000, 154000])
assert.deepEqual(c.schedules, ['2026-12-05T09:00:00.000Z', '2026-12-06T08:00:00.000Z']) // KST 18:00, 17:00
console.log('openData ok')
