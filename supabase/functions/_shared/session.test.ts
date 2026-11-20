import assert from 'node:assert/strict'
import { signedInAt, signedInWithin } from './session.ts'

const jwt = (payload: object) => `x.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.sig`
const now = 1_800_000_000

assert.equal(signedInAt(jwt({ amr: [{ method: 'otp', timestamp: now - 100 }, { method: 'password', timestamp: now - 5000 }] })), now - 100) // 가장 최근
assert.equal(signedInWithin(jwt({ amr: [{ method: 'otp', timestamp: now - 9 * 60 }] }), 600, now), true)
assert.equal(signedInWithin(jwt({ amr: [{ method: 'oauth', timestamp: now - 11 * 60 }] }), 600, now), false)
// amr 이 없거나 깨진 토큰, 미래 시각은 거절
assert.equal(signedInWithin(jwt({ sub: 'u' }), 600, now), false)
assert.equal(signedInWithin('not-a-jwt', 600, now), false)
assert.equal(signedInWithin(jwt({ amr: [{ timestamp: 'x' }] }), 600, now), false)
assert.equal(signedInWithin(jwt({ amr: [{ timestamp: now + 3600 }] }), 600, now), false)
console.log('session OK')
