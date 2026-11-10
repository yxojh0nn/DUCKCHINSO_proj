// 회원 탈퇴. 호출한 사람의 JWT에서 꺼낸 ID 하나만 지운다 (요청 본문은 읽지 않음)
// 순서: 내가 올린 파일 삭제 → 카카오·네이버 연결 끊기 → auth.users 삭제 → DB의 내 데이터는 on delete cascade 로 함께 삭제
import { admin, callerOf, cors, json } from '../_shared/supabase.ts'
import { unlinkAll } from '../_shared/providers.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const user = await callerOf(req)
  if (!user) return json({ error: 'not_authenticated' }, 401)
  if (user.is_anonymous) return json({ error: 'guest_cannot_withdraw' }, 403)

  const db = admin()
  const uid = user.id

  // public-media/{uid}/** (프로필·배너·게시글 사진)
  const publicFiles: string[] = []
  for (const folder of ['avatar', 'banner', 'posts']) {
    const { data } = await db.storage.from('public-media').list(`${uid}/${folder}`, { limit: 1000 })
    data?.forEach((f) => publicFiles.push(`${uid}/${folder}/${f.name}`))
  }
  // chat-media/{room}/{uid}/** (내가 보낸 채팅 사진)
  const chatFiles: string[] = []
  const { data: rooms } = await db.from('chat_members').select('room_id').eq('user_id', uid)
  for (const r of rooms ?? []) {
    const { data } = await db.storage.from('chat-media').list(`${r.room_id}/${uid}`, { limit: 1000 })
    data?.forEach((f) => chatFiles.push(`${r.room_id}/${uid}/${f.name}`))
  }
  if (publicFiles.length) await db.storage.from('public-media').remove(publicFiles)
  if (chatFiles.length) await db.storage.from('chat-media').remove(chatFiles)

  // 연결 끊기가 실패해도 탈퇴는 진행한다 (사용자의 삭제 요청을 막지 않는다). 실패는 기록만
  const unlinkFailed = await unlinkAll(db, uid).catch((e) => [(e as Error).message])
  if (unlinkFailed.length) console.error('unlink_failed', unlinkFailed.join(','))

  const { error } = await db.auth.admin.deleteUser(uid)
  if (error) return json({ error: error.message }, 500)
  return json({ ok: true, removedFiles: publicFiles.length + chatFiles.length })
})
