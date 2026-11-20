// 네이버·카카오 로그인 (docs/로그인_계정_암호화_설계.md 4장). 브라우저가 이 주소를 직접 열므로 --no-verify-jwt 로 배포한다
// ① GET ?provider=naver|kakao&to=app|<웹 주소>&cn=<기기 nonce>  → 서명한 state + 쿠키 nonce 를 들고 제공자 로그인 화면으로
// ② GET ?code=…&state=…  (제공자가 돌려보냄)   → 회원 식별값으로 계정 찾기/만들기 → 일회용 로그인 토큰
//                                                → <돌아갈 곳>/auth/callback#token_hash=…&cn=… (앱이 cn 을 맞춰 본 뒤 verifyOtp 로 세션을 받는다)
// 계정은 이메일이 아니라 제공자 회원 식별값(HMAC)으로 찾는다. 카카오는 이메일을 받지 않는다
import { admin } from '../_shared/supabase.ts'
import { blindIndex, encrypt, signState, verifyState } from '../_shared/crypto.ts'
import { NO_MAIL_DOMAIN, authorizeUrl, fetchIdentity, returnUrl, type Provider } from '../_shared/providers.ts'

// 로그인 CSRF 방지: 시작한 브라우저에만 nonce 쿠키를 심고, 돌아왔을 때 state 안의 nonce 와 맞춘다
const COOKIE = 'sl_nonce'
const cookie = (v: string, age: number) => `${COOKIE}=${v}; Path=/functions/v1/social-login; Max-Age=${age}; HttpOnly; Secure; SameSite=Lax`
// cn: 앱이 이 기기에만 저장한 값. 돌려줄 때 그대로 붙이면 앱이 '내가 시작한 로그인'인지 확인한다
// (남이 자기 계정 토큰을 링크로 보내 로그인시키는 것을 막는다. 예전 앱 번들은 안 보내므로 없어도 받는다)
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const redirect = (url: string, setCookie: string) =>
  new Response(null, { status: 302, headers: { Location: url, 'Set-Cookie': setCookie, 'Cache-Control': 'no-store' } })
const page = (msg: string) =>
  new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><p style="font:16px system-ui;padding:24px">${msg}</p>`,
    { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })

Deno.serve(async (req) => {
  const q = new URL(req.url).searchParams

  // ① 시작
  if (!q.has('state')) {
    const provider = q.get('provider')
    const to = q.get('to') ?? ''
    const cn = q.get('cn')
    if ((provider !== 'naver' && provider !== 'kakao') || !returnUrl(to) || (cn !== null && !UUID.test(cn))) return page('잘못된 로그인 요청이에요.')
    const nonce = crypto.randomUUID()
    try {
      return redirect(authorizeUrl(provider, await signState({ provider, to, nonce, ...(cn ? { cn } : {}) })), cookie(nonce, 600))
    } catch (e) {
      console.error('social_login_start_failed', (e as Error).message) // 비밀값이 없으면 missing_secret:<이름>
      return page('로그인 설정이 아직 끝나지 않았어요. 잠시 후 다시 시도해 주세요.')
    }
  }

  // ② 제공자에서 돌아옴
  const s = await verifyState(q.get('state')!)
  const back = s && returnUrl(String(s.to))
  if (!s || !back) return page('로그인 요청이 만료됐어요. 앱에서 다시 시도해 주세요.')
  const fail = (code: string) => redirect(`${back}#error=${code}`, cookie('', 0))
  const nonce = req.headers.get('cookie')?.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`))?.[1]
  if (nonce !== s.nonce) return fail('state_expired')
  if (q.get('error') || !q.get('code')) return fail('social_cancelled')

  const provider = s.provider as Provider
  try {
    const who = await fetchIdentity(provider, q.get('code')!, q.get('state')!)
    if (provider === 'naver' && !who.email) return fail('naver_email')
    const db = admin()
    const subjectHmac = await blindIndex(provider, who.subject)
    const { data: found } = await db.from('external_ids').select('user_id')
      .eq('provider', provider).eq('subject_hmac', subjectHmac).maybeSingle()
    let uid = found?.user_id as string | undefined

    if (!uid) {
      // 같은 이메일의 다른 계정과 자동으로 합치지 않는다 (설계 10장 3번) → 이미 있으면 원래 방법으로 로그인하라고 안내
      if (who.email && (await db.rpc('email_registered', { p_email: who.email })).data) return fail('email_taken')
      // 네이버 이메일은 네이버가 직접 관리하는 @naver.com 만 '인증된 이메일'로 쓴다. 다른 연락처 주소는 인증 여부를 알 수 없어,
      // 남의 이메일로 먼저 가입해 두면 나중에 그 사람의 구글 로그인이 이 계정에 자동 연결될 수 있다(계정 선점) → 메일 없는 주소로 만든다
      const trusted = who.email && /@naver\.com$/i.test(who.email) ? who.email : null
      const email = trusted ?? `${provider === 'naver' ? 'n' : 'k'}${crypto.randomUUID().replaceAll('-', '')}@${NO_MAIL_DOMAIN}`
      const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true })
      if (error) return fail(error.code === 'email_exists' || /already/i.test(error.message) ? 'email_taken' : 'social_failed')
      uid = data.user.id
      const { error: linkErr } = await db.from('external_ids').insert({
        provider, subject_hmac: subjectHmac, subject_enc: await encrypt(uid, `${provider}_id`, who.subject), user_id: uid,
      })
      // 같은 사람이 동시에 두 번 눌러 먼저 만든 쪽이 이긴 경우: 방금 만든 계정은 지운다
      if (linkErr) { await db.auth.admin.deleteUser(uid); return fail('social_failed') }
    }
    if (who.refreshToken) {
      await db.from('provider_tokens').upsert({
        user_id: uid, provider, refresh_enc: await encrypt(uid, `${provider}_refresh`, who.refreshToken), updated_at: new Date().toISOString(),
      })
    }
    const { data: u } = await db.auth.admin.getUserById(uid)
    const { data: link, error } = await db.auth.admin.generateLink({ type: 'magiclink', email: u.user!.email! })
    if (error) throw error
    const cn = typeof s.cn === 'string' ? `&cn=${s.cn}` : ''
    return redirect(`${back}#token_hash=${encodeURIComponent(link.properties.hashed_token)}${cn}`, cookie('', 0))
  } catch (e) {
    console.error('social_login_failed', provider, (e as Error).message) // 토큰·식별값은 남기지 않는다
    return fail('social_failed')
  }
})
