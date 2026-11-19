// 회원 탈퇴·비회원 나가기. 호출한 사람의 JWT에서 꺼낸 ID 하나만 지운다 (요청 본문은 읽지 않음)
// 순서: 내가 올린 파일 삭제 → 카카오·네이버 연결 끊기 → auth.users 삭제 → DB의 내 데이터는 on delete cascade 로 함께 삭제
import { admin, callerOf, cors, json } from '../_shared/supabase.ts'
import { unlinkAll } from '../_shared/providers.ts'
import { decrypt } from '../_shared/crypto.ts'
import { deleteBillingKey } from '../_shared/pg.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const user = await callerOf(req)
  if (!user) return json({ error: 'not_authenticated' }, 401)
  // 비회원도 지운다: 비회원은 로그아웃(나가기) = 계정 삭제

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

  // 멤버십 PG 구독: 포트원의 빌링키를 먼저 지운다 (DB 쪽은 탈퇴 시 트리거가 구독을 끝내고 빌링키 행을 지움, 결제 기록은 법정 보관)
  const { data: subs } = await db.from('subscriptions').select('id, pg_billing(billing_key_enc)').eq('user_id', uid).eq('platform', 'pg')
  for (const s of subs ?? []) {
    const enc = (s.pg_billing as { billing_key_enc: string } | null)?.billing_key_enc
    if (!enc) continue
    await decrypt(`sub:${s.id}`, 'billing_key', enc, 'BILLING_ENC_KEY').then(deleteBillingKey)
      .catch((e) => console.error('billing_key_delete_failed', s.id, (e as Error).message))
  }

  const { error } = await db.auth.admin.deleteUser(uid)
  if (error) return json({ error: error.message }, 500)
  return json({ ok: true, removedFiles: publicFiles.length + chatFiles.length })
})
