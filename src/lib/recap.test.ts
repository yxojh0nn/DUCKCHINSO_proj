import assert from 'node:assert/strict'
import { buildRecap, dayWithWeek, periodLabel, recapMonths, recapShelf, shelfLabel } from './recap.ts'

const concerts = [
  { id: 'a', title: 'A 투어', posterUrl: 'https://x/a.jpg', venue: 'KSPO DOME', schedules: ['2026-11-07T10:00:00Z', '2026-11-08T09:00:00Z'] }, // KST 19:00, 18:00
  { id: 'b', title: 'B 라이브', posterUrl: null, venue: '블루스퀘어', schedules: ['2026-11-02T11:00:00Z'] },
]
const records = [
  { concertId: 'a', day: '2026-11-08', photoUrl: null },
  { concertId: 'b', day: '2026-11-02', photoUrl: null },
  { concertId: 'gone', day: '2026-10-30', photoUrl: null },
]

const nov = buildRecap('2026-11', records, concerts)
assert.deepEqual(nov.items.map((i) => [i.concertId, i.day, i.time]), [['b', '2026-11-02', '20:00'], ['a', '2026-11-08', '18:00']]) // 날짜 순, 그날 회차 시각
const oct = buildRecap('2026-10', records, concerts)
assert.deepEqual([oct.items[0].title, oct.items[0].time], ['정리된 공연', null]) // 공연 정보가 정리돼도 기록은 남는다
assert.equal(buildRecap('2026', records, concerts).items.length, 3) // 연간
assert.deepEqual(recapMonths(records), ['2026-11', '2026-10'])
assert.equal(periodLabel('2026-11'), '2026년 11월')
assert.equal(dayWithWeek('2026-11-07'), '11월 7일 (토)')
assert.deepEqual(recapShelf([{ day: '2026-11-02' }, { day: '2025-12-24' }, { day: '2026-03-01' }, { day: '2026-11-20' }]), ['2025-12', '2025', '2026-03', '2026-11', '2026'])
assert.equal(shelfLabel('2026'), '돌아보기 26’')
assert.equal(shelfLabel('2026-03'), '2026년 3월')
console.log('recap ok')
