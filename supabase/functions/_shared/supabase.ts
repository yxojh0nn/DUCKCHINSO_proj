import { createClient } from 'npm:@supabase/supabase-js@2.118.0'

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// service role 클라이언트: RLS를 우회하므로 이 파일을 쓰는 함수 안에서만 사용한다 (앱 번들에 들어가지 않음)
export const admin = () =>
  createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

// 요청의 JWT로 "누가 호출했는지"만 확인한다. 사용자 ID는 요청 본문에서 받지 않는다
export async function callerOf(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  const { data } = await admin().auth.getUser(token)
  return data.user ?? null
}

// 운영자 전용 함수의 첫 관문: 로그인한 호출자가 admins 표에 있어야 한다. 막을 때 돌려줄 응답, 통과하면 null
export async function adminGate(req: Request, db: ReturnType<typeof admin>): Promise<Response | null> {
  const caller = await callerOf(req)
  if (!caller) return json({ error: 'not_authenticated' }, 401)
  const { data } = await db.from('admins').select('user_id').eq('user_id', caller.id).maybeSingle()
  return data ? null : json({ error: 'forbidden' }, 403)
}

// Cron 호출 확인: service role 키로 부른 경우만 허용
// 새 키 체계 프로젝트는 함수 환경의 키(sb_secret_…)와 Vault 에 넣은 legacy service_role 키가 문자열로 다를 수 있다.
// 그래서 같은 문자열이 아니면 그 키로 관리자 API 를 한 번 불러 Supabase 가 서버 키로 인정하는지 확인한다
export async function isServiceCall(req: Request) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return false
  if (token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) return true
  const { error } = await createClient(Deno.env.get('SUPABASE_URL')!, token, { auth: { persistSession: false } })
    .auth.admin.listUsers({ page: 1, perPage: 1 })
  return !error
}
