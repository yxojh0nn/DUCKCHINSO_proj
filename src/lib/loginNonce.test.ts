import assert from 'node:assert/strict'
import { challengeOf, issueLoginVerifier, takeLoginVerifier } from './loginNonce.ts'

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) } }

// 같은 기기에서 시작한 로그인만, 한 번만. 꺼낸 verifier 의 해시가 서버에 보낸 cc 와 같다
let s = mem()
const cc = await issueLoginVerifier(s, 1000)
assert.match(cc, /^[A-Za-z0-9_-]{43}$/)
const v = takeLoginVerifier(cc, s, 2000)
assert.ok(v && /^[A-Za-z0-9_-]{43}$/.test(v))
assert.equal(await challengeOf(v!), cc)
assert.equal(takeLoginVerifier(cc, s, 2000), null)
// 남이 만든 링크·가로챈 앱: 이 기기에 그 cc 의 verifier 가 없다
assert.equal(takeLoginVerifier(cc, mem(), 2000), null)
s = mem(); await issueLoginVerifier(s, 1000)
assert.equal(takeLoginVerifier('x'.repeat(43), s, 2000), null)
assert.equal(takeLoginVerifier(null, s, 2000), null)
// 두 번 눌렀다가 앞의 것으로 돌아와도 맞는 verifier, 남은 것은 그대로
s = mem(); const a = await issueLoginVerifier(s, 1000); const b = await issueLoginVerifier(s, 1100)
assert.ok(takeLoginVerifier(a, s, 2000))
assert.ok(takeLoginVerifier(b, s, 2000))
// 10분 지남
s = mem(); const old = await issueLoginVerifier(s, 0)
assert.equal(takeLoginVerifier(old, s, 600_000), null)
console.log('loginNonce OK')
