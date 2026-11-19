import assert from 'node:assert/strict'
import { nearestRegion, regionNear } from '../data/regions.ts'

assert.equal(nearestRegion(37.57, 126.98), '서울') // 광화문
assert.equal(nearestRegion(35.16, 129.16), '부산') // 해운대
assert.equal(nearestRegion(33.25, 126.56), '제주') // 서귀포
assert.equal(regionNear('서울', '서울'), 1)
assert.equal(regionNear('서울', '제주'), 0)
assert.equal(regionNear(null, '서울'), 0)
assert.ok(regionNear('서울', '경기') > regionNear('서울', '대전'))
console.log('regions ok')
