// 포트원이 직접 부르므로 --no-verify-jwt 로 배포한다 (대신 아래 서명 검증이 관문)
// 포트원 웹훅: 서명(Standard Webhooks)·시각을 확인한 뒤, 본문은 "다시 조회하라는 신호"로만 쓴다
// 결제 상태는 포트원 API 로 다시 물어 DB 에 넣는다. 같은 알림이 여러 번 와도 DB 함수가 한 번만 반영한다
// 처리 중 오류면 500 → 포트원이 다시 보낸다
import { admin, json } from '../_shared/supabase.ts'
import { findPayment, isOurPaymentId, settle, sha256, verifyWebhook } from '../_shared/pg.ts'

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const body = await req.text()
  if (body.length > 64_000) return json({ error: 'too_large' }, 413)
  if (!(await verifyWebhook(body, req.headers))) return json({ error: 'bad_signature' }, 401)
  const evt = JSON.parse(body)
  const pid = evt?.data?.paymentId
  const db = admin()
  let result = 'ignored'
  if (isOurPaymentId(pid)) {
    try { result = await settle(db, pid, await findPayment(pid)) } catch (e) {
      console.error('pg_webhook_failed', (e as Error).message)
      return json({ error: 'retry' }, 500)
    }
  }
  await db.rpc('pg_log', { src: 'pg_webhook', ekey: req.headers.get('webhook-id'), sid: null, k: String(evt?.type ?? '').slice(0, 60), res: result, phash: await sha256(body) })
  return json({ ok: true })
})
