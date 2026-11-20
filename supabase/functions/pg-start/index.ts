// 멤버십 결제 시작: 앱이 포트원 결제창에서 받은 빌링키 + 1회용 번호로 첫 달을 청구한다
//   1) 1회용 번호를 쓰고 구독·청구 행을 만든다 (pg_begin: 금액은 DB 값)
//   2) 빌링키를 포트원에 조회해 우리 상점·이 사람(고객 번호)·발급 상태를 확인 → 암호화해 저장
//   3) 서버가 정한 결제 번호로 청구 → 포트원에 다시 조회한 결과만 반영 (금액이 다르면 반영 안 하고 바로 취소)
import { admin, callerOf, cors, json } from '../_shared/supabase.ts'
import { encrypt } from '../_shared/crypto.ts'
import { KEY_NOT_OURS, checkBillingKey, deleteBillingKey, findPayment, getBillingKey, methodLabel, payWithBillingKey, settle, buyerOf } from '../_shared/pg.ts'

const KNOWN = new Set(['checkout_expired', 'already_subscribed'])
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const KEY = /^[A-Za-z0-9_-]{8,200}$/

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const user = await callerOf(req)
  if (!user) return json({ error: 'not_authenticated' }, 401)
  const body = await req.json().catch(() => null)
  const issueId = body?.issueId, billingKey = body?.billingKey
  if (typeof issueId !== 'string' || !UUID.test(issueId) || typeof billingKey !== 'string' || !KEY.test(billingKey)) return json({ error: 'bad_request' }, 400)

  const db = admin()
  const begun = await db.rpc('pg_begin', { uid: user.id, issue: issueId })
  if (begun.error) return json({ error: KNOWN.has(begun.error.message) ? begun.error.message : 'server_error' }, KNOWN.has(begun.error.message) ? 400 : 500)
  const b = begun.data[0] as { subscription_id: number; payment_id: string; amount_krw: number; order_name: string; customer_token: string }
  const fail = async (reason: string, dropKey = true) => {
    await settle(db, b.payment_id, { storeId: Deno.env.get('PORTONE_STORE_ID'), currency: 'KRW', status: 'FAILED', failure: { reason } }).catch(() => {})
    if (dropKey) await deleteBillingKey(billingKey).catch(() => {}) // 쓰지 않을 빌링키는 포트원에서도 지운다
  }

  // 빌링키 주인 확인: 남이 발급받은 키·다른 상점 키·테스트 채널 키는 거절
  const info = await getBillingKey(billingKey).catch(() => null)
  const chk = info ? checkBillingKey(info, b.customer_token) : { ok: false as const, reason: 'lookup_failed' }
  if (!chk.ok) {
    await db.rpc('pg_log', { src: 'checkout', ekey: null, sid: b.subscription_id, k: 'billing_key', res: `rejected:${chk.reason}`, phash: null })
    await fail(`billing_key:${chk.reason}`, !KEY_NOT_OURS.has(chk.reason)) // 남의 키는 포트원에서 지우지 않는다
    return json({ error: 'payment_failed' }, 400)
  }
  const enc = await encrypt(`sub:${b.subscription_id}`, 'billing_key', billingKey, 'BILLING_ENC_KEY')
  const saved = await db.rpc('pg_save_billing', { sid: b.subscription_id, key_enc: enc, label: methodLabel(info), env: chk.env })
  if (saved.error) { await fail('save_failed'); return json({ error: 'server_error' }, 500) }

  // 청구 → 결과는 포트원에 다시 물어서. 청구 응답이 오류여도 결제가 됐을 수 있으니 조회로 판단
  await payWithBillingKey(b.payment_id, { billingKey, orderName: b.order_name, customer: buyerOf(info, b.customer_token), amountKrw: b.amount_krw }).catch(() => {})
  let p
  try { p = await findPayment(b.payment_id) } catch { return json({ pending: true }, 202) } // 조회 실패: 대사 cron 이 마무리
  const r = await settle(db, b.payment_id, p)
  if (r === 'applied') return json({ ok: true })
  if (r === 'pending') return json({ pending: true }, 202)
  await deleteBillingKey(billingKey).catch(() => {})
  return json({ error: 'payment_failed' }, 400)
})
