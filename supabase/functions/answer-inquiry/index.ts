// 운영자 문의 답변: 운영팀 대화방에 답변을 남기고, 가입 이메일로 "답변이 도착했어요" 메일을 보낸다
// 메일 발송은 Resend(https://resend.com) 사용. RESEND_API_KEY 가 없으면 메일만 건너뛴다
import { admin, callerOf, cors, json } from '../_shared/supabase.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const caller = await callerOf(req)
  if (!caller) return json({ error: 'not_authenticated' }, 401)
  const db = admin()
  const { data: isAdmin } = await db.from('admins').select('user_id').eq('user_id', caller.id).maybeSingle()
  if (!isAdmin) return json({ error: 'forbidden' }, 403)

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

  let mailed = false
  const key = Deno.env.get('RESEND_API_KEY')
  const { data: u } = await db.auth.admin.getUserById(inq.user_id)
  if (key && u.user?.email) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: Deno.env.get('MAIL_FROM') ?? '덕친소 <noreply@duckchinso.app>',
        to: u.user.email,
        subject: '[덕친소] 문의하신 내용에 답변이 도착했어요',
        text: '덕친소 앱의 채팅 탭 > 덕친소 운영팀 대화방에서 답변을 확인해 주세요.',
      }),
    })
    mailed = res.ok
  }
  return json({ ok: true, roomId, mailed })
})
