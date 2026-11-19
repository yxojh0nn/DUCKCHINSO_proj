// 멤버십 결제 준비: 로그인 회원만. 금액·첫 달 할인·고객 번호는 DB(pg_checkout)가 정하고, 1회용 번호(15분)를 돌려준다
// 요청 본문은 읽지 않는다 (사용자는 JWT 에서만)
import { admin, callerOf, cors, json } from '../_shared/supabase.ts'

const KNOWN = new Set(['members_only', 'not_ready', 'already_subscribed'])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const user = await callerOf(req)
  if (!user) return json({ error: 'not_authenticated' }, 401)
  const db = admin()
  // 1분에 5번까지 (결제 준비 번호를 마구 만들지 못하게)
  const { count } = await db.from('checkout_intents').select('issue_id', { count: 'exact', head: true })
    .eq('user_id', user.id).gt('expires_at', new Date(Date.now() + 14 * 60_000).toISOString())
  if ((count ?? 0) >= 5) return json({ error: 'too_many_requests' }, 429)
  const { data, error } = await db.rpc('pg_checkout', { uid: user.id })
  if (error) return json({ error: KNOWN.has(error.message) ? error.message : 'server_error' }, KNOWN.has(error.message) ? 400 : 500)
  const r = data[0]
  return json({ issueId: r.issue_id, customerId: r.customer_token, orderName: r.order_name, amountKrw: r.amount_krw, promo: r.promo })
})
