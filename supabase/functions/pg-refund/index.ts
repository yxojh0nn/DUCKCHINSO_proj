// 운영자 환불: 그 구독의 이번 기간 결제를 (일부) 취소하고 구독을 바로 끝낸다. 사유 필수, 기록 남김
// 금액을 빼면 남은 전액. 환불 기준(7일 전액·일할)은 docs/결제_멤버십_연동_설계.md 의 환불 정책
import { admin, adminGate, cors, json } from '../_shared/supabase.ts'
import { cancelPayment, findPayment, settle } from '../_shared/pg.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const db = admin()
  const blocked = await adminGate(req, db)
  if (blocked) return blocked
  const body = await req.json().catch(() => null)
  const sid = body?.subscriptionId, reason = body?.reason
  if (!Number.isSafeInteger(sid) || typeof reason !== 'string' || reason.trim().length < 2 || reason.length > 200) return json({ error: 'bad_request' }, 400)
  const { data } = await db.rpc('pg_refund_quote', { sid })
  const q = data?.[0]
  if (!q) return json({ error: 'not_found' }, 404)
  const amount = body.amountKrw ?? q.refundable_krw
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > q.refundable_krw) return json({ error: 'bad_amount' }, 400)
  try {
    await cancelPayment(q.payment_id, amount, reason.trim())
    const r = await settle(db, q.payment_id, await findPayment(q.payment_id))
    await db.rpc('pg_log', { src: 'admin', ekey: null, sid, k: `refund:${amount}`, res: r, phash: null })
    return json({ ok: true, refundedKrw: amount })
  } catch (e) {
    await db.rpc('pg_log', { src: 'admin', ekey: null, sid, k: `refund:${amount}`, res: `error:${(e as Error).message}`, phash: null })
    return json({ error: 'refund_failed' }, 502)
  }
})
