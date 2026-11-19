import assert from 'node:assert/strict'
import { buyerError, phoneDigits } from './buyer.ts'

const ok = { name: '홍길동', phone: '010-1234-5678', email: 'a@b.co' }
assert.equal(buyerError(ok), null)
assert.equal(phoneDigits(ok.phone), '01012345678')
assert.equal(buyerError({ ...ok, phone: '011 123 4567' }), null) // 10자리 옛 번호
assert.ok(buyerError({ ...ok, name: '  ' }))
assert.ok(buyerError({ ...ok, phone: '02-123-4567' })) // 집 전화
assert.ok(buyerError({ ...ok, email: 'a@b' }))
console.log('buyer ok')
