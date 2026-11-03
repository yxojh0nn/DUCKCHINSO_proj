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

// Cron 호출 확인: service role 키로 부른 경우만 허용
export const isServiceCall = (req: Request) =>
  req.headers.get('Authorization') === `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
