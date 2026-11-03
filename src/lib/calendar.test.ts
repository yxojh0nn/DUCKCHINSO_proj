// node --experimental-strip-types src/lib/calendar.test.ts
import assert from 'node:assert/strict'
import { layoutMarks, monthGrid } from './calendar.ts'

const g = monthGrid(2026, 11) // 2026-11-01 은 일요일
assert.equal(g[0][0], '2026-11-01')
assert.equal(g.flat().filter(Boolean).length, 30)
assert.equal(g.every((w) => w.length === 7), true)

const m = layoutMarks([
  { id: 'single-a', days: ['2026-11-22'] },
  { id: 'single-b', days: ['2026-11-22'] },
  { id: 'tour', days: ['2026-11-14', '2026-11-15'] }, // 토·일: 주가 바뀌는 곳
  { id: 'run', days: ['2026-11-08', '2026-11-09', '2026-11-10'] },
  { id: 'gap', days: ['2026-11-09', '2026-11-12'] },
])
assert.equal(m.get('2026-11-22')!.dots.length, 2)
// 토요일(14)은 오른쪽으로 잇지 않는다 (줄 바뀜), 일요일(15)은 왼쪽으로 잇지 않는다
assert.deepEqual(m.get('2026-11-14')!.segments.map((s) => [s.joinLeft, s.joinRight]), [[false, false]])
assert.deepEqual(m.get('2026-11-09')!.segments.find((s) => s.id === 'run')!, { id: 'run', lane: 0, color: m.get('2026-11-09')!.segments[0].color, joinLeft: true, joinRight: true })
// 'gap' 은 'run'과 9일이 겹쳐 두 번째 줄로 가고, 떨어진 12일도 짧은 선(양쪽 안 이음)
assert.equal(m.get('2026-11-12')!.segments[0].lane, 1)
assert.deepEqual([m.get('2026-11-12')!.segments[0].joinLeft, m.get('2026-11-12')!.segments[0].joinRight], [false, false])
console.log('calendar ok')
