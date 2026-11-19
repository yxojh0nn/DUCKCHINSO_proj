import assert from 'node:assert/strict'
import { fullMonths } from './months.ts'

const d = (s: string) => new Date(s)
assert.equal(fullMonths(d('2026-01-15T10:00'), d('2026-01-15T10:00')), 0) // 결제 당일
assert.equal(fullMonths(d('2026-01-15T10:00'), d('2026-02-15T09:59')), 0) // 한 달에서 1분 모자람
assert.equal(fullMonths(d('2026-01-15T10:00'), d('2026-02-15T10:00')), 1) // 한 달 채움
assert.equal(fullMonths(d('2026-01-15T10:00'), d('2027-01-20T00:00')), 12) // 해 넘김
assert.equal(fullMonths(d('2026-01-31T10:00'), d('2026-02-27T23:00')), 0) // 31일 시작, 2월 말일 전
assert.equal(fullMonths(d('2026-01-31T10:00'), d('2026-02-28T10:00')), 1) // 2월은 28일이 "같은 날"
assert.equal(fullMonths(d('2026-01-31T10:00'), d('2026-03-30T10:00')), 1) // 3월 31일 전
assert.equal(fullMonths(d('2026-01-31T10:00'), d('2026-03-31T10:00')), 2)
console.log('months ok')
