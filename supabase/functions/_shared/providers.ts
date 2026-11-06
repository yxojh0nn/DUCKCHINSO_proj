// 네이버·카카오 로그인 (Supabase 기본 제공자가 아니므로 social-login 함수가 OAuth 를 직접 한다)
// 비밀값: NAVER_CLIENT_ID · NAVER_CLIENT_SECRET · KAKAO_REST_KEY · KAKAO_CLIENT_SECRET(카카오 콘솔에서 켰을 때만) · KAKAO_ADMIN_KEY(탈퇴 연결 끊기)
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.118.0'
import { decrypt } from './crypto.ts'

export type Provider = 'naver' | 'kakao'

// 카카오 계정은 이메일을 받지 않는다(카카오 회원번호로 계정을 찾는다). auth 에 이메일 칸이 필요해 넣는 자리 채움 주소. 이 주소로 메일을 보내지 않는다
export const NO_MAIL_DOMAIN = 'kakao.noemail.duckchinso.app'

const env = (n: string) => Deno.env.get(n) ?? ''
const qs = (o: Record<string, string>) => new URLSearchParams(o).toString()
export const callbackUrl = () => `${env('SUPABASE_URL')}/functions/v1/social-login`

// 로그인·메일 인증 후 돌아갈 주소. 'app' 또는 비밀값 SITE_ORIGINS="https://<도메인>,http://localhost:5173" 에 있는 웹 주소만
export const returnUrl = (to: string) => {
  if (to === 'app') return 'com.duckchinso.app://auth/callback'
  const allowed = env('SITE_ORIGINS').split(',').map((s) => s.trim()).filter(Boolean)
  return allowed.includes(to) ? `${to}/auth/callback` : null
}

export function authorizeUrl(p: Provider, state: string) {
  const id = p === 'naver' ? 'NAVER_CLIENT_ID' : 'KAKAO_REST_KEY'
  if (!env(id)) throw new Error(`missing_secret:${id}`) // 키가 없으면 제공자 오류 화면 대신 우리 안내 화면
  return p === 'naver'
    ? `https://nid.naver.com/oauth2.0/authorize?${qs({ response_type: 'code', client_id: env('NAVER_CLIENT_ID'), redirect_uri: callbackUrl(), state })}`
    : `https://kauth.kakao.com/oauth/authorize?${qs({ response_type: 'code', client_id: env('KAKAO_REST_KEY'), redirect_uri: callbackUrl(), state })}`
}

// 네이버 토큰 주소는 문서대로 쿼리 문자열로 부른다 (발급·갱신·삭제 모두 같은 주소)
const naverToken = async (o: Record<string, string>) =>
  (await fetch(`https://nid.naver.com/oauth2.0/token?${qs({ client_id: env('NAVER_CLIENT_ID'), client_secret: env('NAVER_CLIENT_SECRET'), ...o })}`)).json()

const kakaoPost = async (url: string, o: Record<string, string>, auth?: string) =>
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8', ...(auth ? { Authorization: auth } : {}) },
    body: qs(o),
  })

// code → 회원 식별값. 네이버는 이메일(필수 동의)과 탈퇴용 refresh token 도 받는다
export async function fetchIdentity(p: Provider, code: string, state: string): Promise<{ subject: string; email: string | null; refreshToken?: string }> {
  if (p === 'naver') {
    const t = await naverToken({ grant_type: 'authorization_code', code, state })
    if (!t.access_token) throw new Error(`naver_token:${t.error ?? 'none'}`)
    const me = await (await fetch('https://openapi.naver.com/v1/nid/me', { headers: { Authorization: `Bearer ${t.access_token}` } })).json()
    if (me.resultcode !== '00' || !me.response?.id) throw new Error(`naver_me:${me.resultcode}`)
    return { subject: String(me.response.id), email: me.response.email ?? null, refreshToken: t.refresh_token }
  }
  const body: Record<string, string> = { grant_type: 'authorization_code', client_id: env('KAKAO_REST_KEY'), redirect_uri: callbackUrl(), code }
  if (env('KAKAO_CLIENT_SECRET')) body.client_secret = env('KAKAO_CLIENT_SECRET')
  const t = await (await kakaoPost('https://kauth.kakao.com/oauth/token', body)).json()
  if (!t.access_token) throw new Error(`kakao_token:${t.error_code ?? t.error ?? 'none'}`)
  const me = await (await fetch('https://kapi.kakao.com/v2/user/me', { headers: { Authorization: `Bearer ${t.access_token}` } })).json()
  if (!me.id) throw new Error('kakao_me')
  return { subject: String(me.id), email: null }
}

// 탈퇴 때 외부 연결 끊기 (설계 7장). 실패해도 탈퇴는 진행하므로 실패 목록만 돌려준다
export async function unlinkAll(db: SupabaseClient, uid: string) {
  const failed: string[] = []
  const { data: ext } = await db.from('external_ids').select('provider, subject_enc').eq('user_id', uid)
  for (const e of ext ?? []) {
    if (e.provider !== 'kakao') continue
    try {
      const id = await decrypt(uid, 'kakao_id', e.subject_enc)
      const r = await kakaoPost('https://kapi.kakao.com/v1/user/unlink', { target_id_type: 'user_id', target_id: id }, `KakaoAK ${env('KAKAO_ADMIN_KEY')}`)
      if (!r.ok) failed.push(`kakao:${r.status}`)
    } catch (err) { failed.push(`kakao:${(err as Error).message}`) }
  }
  const { data: tokens } = await db.from('provider_tokens').select('provider, refresh_enc').eq('user_id', uid)
  for (const t of tokens ?? []) {
    if (t.provider !== 'naver') continue // shortcut: 애플 토큰 철회는 애플 로그인 키를 받은 뒤 함께 넣는다 (Apple 5.1.1(v))
    try {
      const fresh = await naverToken({ grant_type: 'refresh_token', refresh_token: await decrypt(uid, 'naver_refresh', t.refresh_enc) })
      const del = fresh.access_token ? await naverToken({ grant_type: 'delete', access_token: fresh.access_token, service_provider: 'NAVER' }) : null
      if (del?.result !== 'success') failed.push(`naver:${fresh.error ?? del?.error ?? 'fail'}`)
    } catch (err) { failed.push(`naver:${(err as Error).message}`) }
  }
  return failed
}
