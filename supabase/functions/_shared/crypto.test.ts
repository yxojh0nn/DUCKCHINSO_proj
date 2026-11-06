// 실행: node --experimental-strip-types supabase/functions/_shared/crypto.test.ts (pnpm test 에 포함)
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'

// 테스트 전용 임의 키 (실제 키와 무관)
for (const k of ['PII_ENC_KEY', 'PII_HMAC_KEY', 'LOGIN_STATE_KEY']) process.env[k] = randomBytes(32).toString('base64')
const { encrypt, decrypt, blindIndex, emailCode, signState, verifyState } = await import('./crypto.ts')

// 왕복, 매번 다른 암호문
const a = await encrypt('u1', 'login_id', 'duck_fan01')
assert.match(a, /^v1:[^:]+:[^:]+$/)
assert.notEqual(a, await encrypt('u1', 'login_id', 'duck_fan01'))
assert.equal(await decrypt('u1', 'login_id', a), 'duck_fan01')
assert.equal(await decrypt('u1', 'k', await encrypt('u1', 'k', '한글 ✓')), '한글 ✓')

// 다른 사용자·다른 칸으로 옮겨 붙이면 실패, 변조해도 실패
await assert.rejects(decrypt('u2', 'login_id', a))
await assert.rejects(decrypt('u1', 'naver_id', a))
const [v, iv, ct] = a.split(':')
await assert.rejects(decrypt('u1', 'login_id', `${v}:${iv}:${ct.slice(0, -4)}AAAA`))
await assert.rejects(decrypt('u1', 'login_id', 'v2:x:y'), /bad_ciphertext/)

// 블라인드 인덱스: 같은 입력 같은 값, 용도(scope)가 다르면 다른 값
assert.equal(await blindIndex('login', 'duck'), await blindIndex('login', 'duck'))
assert.notEqual(await blindIndex('login', 'duck'), await blindIndex('naver', 'duck'))

// state: 정상, 변조, 만료
const s = await signState({ provider: 'naver', to: 'app' })
assert.equal((await verifyState(s))?.provider, 'naver')
assert.equal(await verifyState(s.replace(/^./, (c) => (c === 'e' ? 'f' : 'e'))), null)
assert.equal(await verifyState(await signState({ p: 1 }, -1)), null)
assert.equal(await verifyState('garbage'), null)

// 메일 인증 코드: 6자리, 정해진 글자만, 매번 다름
const codes = Array.from({ length: 200 }, emailCode)
assert.ok(codes.every((c) => /^[A-HJ-NP-Z2-9]{6}$/.test(c)))
assert.ok(new Set(codes).size > 190)

// 키가 없으면 분명한 오류 (키 값은 메시지에 없다)
delete process.env.PII_ENC_KEY
await assert.rejects(encrypt('u1', 'k', 'x'), /missing_secret:PII_ENC_KEY/)
console.log('crypto OK')
