// 실행: node --experimental-strip-types src/lib/klipy.test.ts
import assert from 'node:assert/strict'
import { customerId, isKlipyUrl, toPage } from './klipy.ts'

const page = toPage({ data: { current_page: 2, has_next: true, data: [
  { slug: 'a', file: { hd: undefined, md: { webp: { url: 'https://static.klipy.com/md-a.webp' } }, sm: { gif: { url: 'https://static.klipy.com/sm-a.gif' } }, xs: undefined } },
  { slug: 'ad' }, // 파일 없는 항목은 건너뛴다
  { slug: 'b', file: { hd: undefined, md: { gif: { url: 'https://static1.klipy.com/md-b.gif' } }, sm: undefined, xs: undefined } },
] } })
assert.deepEqual(page, { next: 3, items: [
  { slug: 'a', url: 'https://static.klipy.com/md-a.webp', preview: 'https://static.klipy.com/sm-a.gif' },
  { slug: 'b', url: 'https://static1.klipy.com/md-b.gif', preview: 'https://static1.klipy.com/md-b.gif' },
] })
assert.equal(toPage({ data: { has_next: false, data: [] } }).next, null)
assert.equal(toPage({}).items.length, 0)

assert.ok(isKlipyUrl('https://static2.klipy.com/x.webp'))
assert.ok(!isKlipyUrl('https://static.klipy.com.evil.com/x.webp'))
assert.ok(!isKlipyUrl('room/user/a.jpg'))

const c = await customerId('u1')
assert.equal(c, await customerId('u1'))
assert.match(c, /^[0-9a-f]{64}$/)
assert.notEqual(c, await customerId('u2'))
console.log('klipy OK')
