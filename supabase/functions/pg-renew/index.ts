// 15분마다 (pg_cron, service role 키로만): 결과가 안 온 청구 확인 → 결제일이 된 구독 청구 → 해지·연체 정리
// 한 구독이 실패해도 나머지는 계속한다. 청구 번호는 DB 가 만든 고정값이라 겹쳐 돌아도 두 번 청구되지 않는다
import { admin, isServiceCall, json } from '../_shared/supabase.ts'
import { decrypt } from '../_shared/crypto.ts'
import { buyerOf, findPayment, getBillingKey, payWithBillingKey, settle } from '../_shared/pg.ts'

Deno.serve(async (req) => {
  if (!(await isServiceCall(req))) return json({ error: 'forbidden' }, 403)
  const db = admin()
  const out = { reconciled: 0, charged: 0, failed: 0, swept: 0 }

  // 1) 청구 행만 있고 결과가 없는 것: 포트원에 물어 마무리 (결제가 아예 없으면 실패 처리)
  const stale = await db.rpc('pg_stale_charges')
  for (const c of stale.data ?? []) {
    try { await settle(db, c.payment_id, await findPayment(c.payment_id)); out.reconciled++ } catch (e) { console.error('reconcile_failed', c.payment_id, (e as Error).message) }
  }

  // 2) 결제일·재시도 시각이 된 구독
  const due = await db.rpc('pg_due', { max_rows: 50 })
  for (const d of due.data ?? []) {
    try {
      const billingKey = await decrypt(`sub:${d.subscription_id}`, 'billing_key', d.billing_key_enc, 'BILLING_ENC_KEY')
      const info = await getBillingKey(billingKey).catch(() => null) // 구매자 정보 (조회 실패면 고객 번호만: 간편결제는 그걸로 된다)
      await payWithBillingKey(d.payment_id, { billingKey, orderName: d.order_name, customer: buyerOf(info, d.customer_token), amountKrw: d.amount_krw }).catch(() => {})
      const r = await settle(db, d.payment_id, await findPayment(d.payment_id))
      if (r === 'applied') out.charged++
      else out.failed++
    } catch (e) {
      out.failed++
      console.error('renew_failed', d.payment_id, (e as Error).message) // 청구 행은 pending 으로 남고 다음 회차 1) 에서 마무리
    }
  }

  // 3) 해지 예약 만료·14일 넘은 연체 정리
  const swept = await db.rpc('pg_sweep')
  out.swept = swept.data?.length ?? 0
  return json(out)
})
