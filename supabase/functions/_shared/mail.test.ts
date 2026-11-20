import assert from 'node:assert/strict'
import { normEmail } from './mail.ts'

assert.equal(normEmail('  Fan.Duck+1@Gmail.COM '), 'fan.duck+1@gmail.com')
assert.equal(normEmail('a@sub.naver.com'), 'a@sub.naver.com')
// 비ASCII: DB lower() 로는 ASCII 와 같아지지만 메일은 다른 곳으로 갈 수 있는 문자들
assert.equal(normEmail('victim@gmaİl.com'), null) // U+0130
assert.equal(normEmail('victim@Kakao.com'), 'victim@kakao.com') // 켈빈 기호는 JS 소문자화로 ASCII 'k' → 조회·발송이 같은 주소라 안전
assert.equal(normEmail('팬@gmail.com'), null)
assert.equal(normEmail('fan@덕친소.한국'), null)
// 형식
for (const bad of ['', 'a', 'a@b', '@gmail.com', 'a b@gmail.com', 'a@@gmail.com', 'a@gmail..com', null, undefined, 42]) assert.equal(normEmail(bad), null, String(bad))
assert.equal(normEmail(`${'a'.repeat(250)}@b.co`), null) // 254자 초과
console.log('mail OK')
