// 운영자 문의 답변: 문의에 답변을 저장하고(사용자는 MY > 문의 > 문의 내역에서 본다), 가입 이메일로 "답변이 도착했어요" 메일을 보낸다
// 메일 발송은 _shared/mail.ts (RESEND_API_KEY 가 없거나 카카오 계정처럼 이메일이 없으면 메일만 건너뛴다)
import { admin, adminGate, cors, json } from '../_shared/supabase.ts'
import { sendMail } from '../_shared/mail.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const db = admin()
  const denied = await adminGate(req, db)
  if (denied) return denied

  const { inquiryId, answer } = await req.json()
  if (typeof inquiryId !== 'string' || typeof answer !== 'string' || !answer.trim()) return json({ error: 'bad_request' }, 400)

  const { data: inq } = await db.from('inquiries').select('id, user_id').eq('id', inquiryId).single()
  if (!inq) return json({ error: 'not_found' }, 404)

  const { error } = await db.from('inquiries').update({ status: 'answered', answer: answer.trim(), answered_at: new Date().toISOString() }).eq('id', inquiryId)
  if (error) return json({ error: 'save_failed' }, 500)

  const { data: u } = await db.auth.admin.getUserById(inq.user_id)
  const mailed = await sendMail(u.user?.email, '[덕친소] 문의하신 내용에 답변이 도착했어요',
    '덕친소 앱의 MY > 문의 > 문의 내역에서 답변을 확인해 주세요.')
  return json({ ok: true, mailed })
})
