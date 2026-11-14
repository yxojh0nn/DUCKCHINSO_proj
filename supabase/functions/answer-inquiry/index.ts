// 운영자 문의 답변: 운영팀 대화방에 답변을 남기고, 가입 이메일로 "답변이 도착했어요" 메일을 보낸다
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

  const { data: inq } = await db.from('inquiries').select('id, user_id, category').eq('id', inquiryId).single()
  if (!inq) return json({ error: 'not_found' }, 404)

  // 사용자의 운영팀 대화방 (문의 접수 때 만들어 둔다)
  const { data: rooms } = await db.from('chat_members').select('room_id, chat_rooms!inner(kind)')
    .eq('user_id', inq.user_id).eq('chat_rooms.kind', 'support').limit(1)
  let roomId = rooms?.[0]?.room_id as string | undefined
  if (!roomId) {
    const { data: room } = await db.from('chat_rooms').insert({ kind: 'support' }).select('id').single()
    roomId = room!.id
    await db.from('chat_members').insert({ room_id: roomId, user_id: inq.user_id })
  }
  await db.from('messages').insert({ room_id: roomId, sender_id: null, kind: 'text', body: answer.trim() })
  await db.from('inquiries').update({ status: 'answered', answer: answer.trim(), answered_at: new Date().toISOString() }).eq('id', inquiryId)

  const { data: u } = await db.auth.admin.getUserById(inq.user_id)
  const mailed = await sendMail(u.user?.email, '[덕친소] 문의하신 내용에 답변이 도착했어요',
    '덕친소 앱의 채팅 탭 > 덕친소 운영팀 대화방에서 답변을 확인해 주세요.')
  return json({ ok: true, roomId, mailed })
})
