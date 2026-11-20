// node --experimental-strip-types src/lib/date.test.ts
import assert from 'node:assert/strict'
import { focusDay, lastPlayed } from './date.ts'

const today = '2026-11-21'
// 다가오는 공연: 첫 회차
assert.equal(focusDay({ schedules: ['2026-12-05T09:00:00.000Z', '2026-12-06T09:00:00.000Z'] }, today), '2026-12-05')
// 지난 공연: 마지막 회차
assert.equal(focusDay({ schedules: ['2026-10-03T09:00:00.000Z', '2026-10-04T09:00:00.000Z'] }, today), '2026-10-04')
// 진행 중: 오늘 이후 첫 회차 (오늘 포함)
assert.equal(focusDay({ schedules: ['2026-11-20T09:00:00.000Z', '2026-11-21T09:00:00.000Z', '2026-11-22T09:00:00.000Z'] }, today), '2026-11-21')
// KST 기준: UTC 11-30 16:00 = KST 12-01
assert.equal(focusDay({ schedules: ['2026-11-30T16:00:00.000Z'] }, today), '2026-12-01')
// 지난 공연: 지금 시각 이전 마지막 회차. 오늘 이미 시작한 회차도 포함, 아직 안 열린 회차는 제외
const now = Date.parse('2026-11-21T10:00:00.000Z')
assert.equal(lastPlayed({ schedules: ['2026-11-20T09:00:00.000Z', '2026-11-21T09:00:00.000Z', '2026-11-22T09:00:00.000Z'] }, now), '2026-11-21T09:00:00.000Z')
assert.equal(lastPlayed({ schedules: ['2026-11-21T11:00:00.000Z'] }, now), '')
// until: 선택한 날짜(KST)까지 열린 회차만
assert.equal(lastPlayed({ schedules: ['2026-11-10T09:00:00.000Z', '2026-11-20T09:00:00.000Z'] }, now, '2026-11-15'), '2026-11-10T09:00:00.000Z')
assert.equal(lastPlayed({ schedules: ['2026-11-20T09:00:00.000Z'] }, now, '2026-11-15'), '')
console.log('date ok')
