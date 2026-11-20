// 실행: node --experimental-strip-types supabase/functions/_shared/pg.test.ts (pnpm test 에 포함)
import assert from 'node:assert/strict'
import { createHmac, randomBytes } from 'node:crypto'
import { buyerOf, checkBillingKey, isOurPaymentId, methodLabel, payState, verifyWebhook } from './pg.ts'

// 웹훅 서명: 맞는 서명, 틀린 비밀값, 본문 변조, 오래된 알림, 머리글 빠짐
const secret = randomBytes(24).toString('base64')
const body = JSON.stringify({ type: 'Transaction.Paid', data: { paymentId: 'mbr_1_0_0' } })
const now = Date.now()
const ts = String(Math.floor(now / 1000))
const sign = (b: string, s = secret, t = ts) => 'v1,' + createHmac('sha256', Buffer.from(s, 'base64')).update(`wh_1.${t}.${b}`).digest('base64')
const h = (sig: string, t = ts) => new Headers({ 'webhook-id': 'wh_1', 'webhook-timestamp': t, 'webhook-signature': sig })
assert.equal(await verifyWebhook(body, h(sign(body)), secret, now), true)
assert.equal(await verifyWebhook(body, h(`v1,AAAA ${sign(body)}`), secret, now), true) // 여러 서명 중 하나만 맞아도 (키 교체 중)
assert.equal(await verifyWebhook(body, h(sign(body)), `whsec_${secret}`, now), true)
assert.equal(await verifyWebhook(body, h(sign(body, randomBytes(24).toString('base64'))), secret, now), false)
assert.equal(await verifyWebhook(body.replace('mbr_1', 'mbr_2'), h(sign(body)), secret, now), false)
const old = String(Math.floor(now / 1000) - 301)
assert.equal(await verifyWebhook(body, h(sign(body, secret, old), old), secret, now), false)
assert.equal(await verifyWebhook(body, new Headers({ 'webhook-id': 'wh_1' }), secret, now), false)
assert.equal(await verifyWebhook(body, h(sign(body)), '', now), false)

// 빌링키: 다른 상점·다른 사람·발급 안 됨·테스트 채널은 거절
const key = { status: 'ISSUED', storeId: 'store-1', customer: { id: 'tok-1' }, channels: [{ type: 'LIVE' }] }
assert.deepEqual(checkBillingKey(key, 'tok-1', 'store-1', false), { ok: true, env: 'production' })
assert.equal(checkBillingKey({ ...key, customer: { id: 'tok-2' } }, 'tok-1', 'store-1', false).ok, false)
assert.equal(checkBillingKey({ ...key, storeId: 'store-2' }, 'tok-1', 'store-1', false).ok, false)
assert.equal(checkBillingKey({ ...key, status: 'DELETED' }, 'tok-1', 'store-1', false).ok, false)
assert.equal(checkBillingKey(key, 'tok-1', undefined, false).ok, false)
assert.deepEqual(checkBillingKey({ ...key, channels: [{ type: 'TEST' }] }, 'tok-1', 'store-1', false), { ok: false, reason: 'test_channel' })
assert.deepEqual(checkBillingKey({ ...key, channels: [{ type: 'TEST' }] }, 'tok-1', 'store-1', true), { ok: true, env: 'sandbox' })
assert.deepEqual(checkBillingKey({ ...key, channels: [] }, 'tok-1', 'store-1', false), { ok: false, reason: 'no_channel' }) // 채널을 모르면 거절
assert.deepEqual(checkBillingKey({ ...key, channels: undefined }, 'tok-1', 'store-1', false), { ok: false, reason: 'no_channel' })

// 결제 상태: 다른 상점·다른 통화면 실패, 금액은 포트원 값 그대로 (비교는 DB 가)
const pay = { storeId: 'store-1', currency: 'KRW', status: 'PAID', amount: { total: 3900 }, paidAt: '2026-11-18T00:00:00Z' }
assert.deepEqual(payState(pay, 'store-1'), { kind: 'paid', krw: 3900, paidAt: '2026-11-18T00:00:00Z' })
assert.equal(payState({ ...pay, storeId: 'x' }, 'store-1').kind, 'failed')
assert.equal(payState({ ...pay, currency: 'USD' }, 'store-1').kind, 'failed')
assert.deepEqual(payState({ ...pay, status: 'FAILED', failure: { reason: '한도 초과' } }, 'store-1'), { kind: 'failed', reason: '한도 초과' })
assert.deepEqual(payState({ ...pay, status: 'CANCELLED', amount: { total: 3900, cancelled: 3900 } }, 'store-1'), { kind: 'canceled', canceledKrw: 3900 })
assert.equal(payState({ ...pay, status: 'READY' }, 'store-1').kind, 'pending')

// 표시 이름, 청구 번호 모양
assert.equal(methodLabel({ methods: [{ type: 'BillingKeyPaymentMethodEasyPay', provider: 'KAKAOPAY' }] }), '카카오페이')
assert.equal(methodLabel({ methods: [{ type: 'BillingKeyPaymentMethodCard', card: { name: '신한카드', number: '53275000****1234' } }] }), '신한카드 ****1234')
assert.equal(methodLabel({ methods: [{ card: { name: '국민카드', number: '5327********12**' } }] }), '국민카드')
assert.equal(methodLabel({}), '등록한 결제 수단')
// 청구 구매자: 포트원 빌링키 정보의 이름·전화·이메일, id 는 언제나 우리 고객 번호
assert.deepEqual(buyerOf({ customer: { id: 'x', name: '홍길동', phoneNumber: '01012345678', email: 'a@b.co' } }, 'tok'),
  { id: 'tok', name: { full: '홍길동' }, phoneNumber: '01012345678', email: 'a@b.co' })
assert.deepEqual(buyerOf(null, 'tok'), { id: 'tok' })
assert.ok(isOurPaymentId('mbr_12_0_0'))
assert.ok(!isOurPaymentId('mbr_12_0_0; drop'))
assert.ok(!isOurPaymentId('order_1'))
console.log('pg ok')
