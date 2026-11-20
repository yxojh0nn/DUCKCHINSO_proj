import assert from 'node:assert/strict'
import { clientIp } from './ip.ts'

const h = (o: Record<string, string>) => new Headers(o)
// 클라이언트가 x-forwarded-for 앞에 아무 값이나 넣어도 키가 바뀌지 않는다
assert.equal(clientIp(h({ 'x-forwarded-for': '10.0.0.1, 203.0.113.77' })), '203.0.113.77')
assert.equal(clientIp(h({ 'x-forwarded-for': '10.0.0.2, 203.0.113.77' })), '203.0.113.77')
// cf-connecting-ip 가 있으면 그것만
assert.equal(clientIp(h({ 'cf-connecting-ip': '198.51.100.9', 'x-forwarded-for': '1.2.3.4' })), '198.51.100.9')
assert.equal(clientIp(h({ 'x-forwarded-for': '203.0.113.77' })), '203.0.113.77')
assert.equal(clientIp(h({ 'x-forwarded-for': ' , ' })), 'unknown')
assert.equal(clientIp(h({})), 'unknown')
console.log('ip OK')
