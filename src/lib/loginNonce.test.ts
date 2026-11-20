import assert from 'node:assert/strict'
import { issueLoginNonce, takeLoginNonce } from './loginNonce.ts'

const mem = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) } }

// 같은 기기에서 시작한 로그인만 통과, 한 번만
let s = mem()
const cn = issueLoginNonce(s, 1000)
assert.equal(takeLoginNonce(cn, s, 2000), true)
assert.equal(takeLoginNonce(cn, s, 2000), false)
// 남이 만든 링크: 저장된 값이 없거나 다르다
assert.equal(takeLoginNonce(cn, mem(), 2000), false)
s = mem(); issueLoginNonce(s, 1000)
assert.equal(takeLoginNonce('other', s, 2000), false)
assert.equal(takeLoginNonce('other', s, 2000), false) // 틀려도 지워진다
// cn 이 없는 예전 응답, 10분 지남
s = mem(); issueLoginNonce(s, 0)
assert.equal(takeLoginNonce(null, s, 1), false)
s = mem(); const old = issueLoginNonce(s, 0)
assert.equal(takeLoginNonce(old, s, 600_000), false)
console.log('loginNonce OK')
