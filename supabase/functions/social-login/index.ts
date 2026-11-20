// 네이버·카카오 로그인 (docs/로그인_계정_암호화_설계.md 4장). 브라우저가 이 주소를 직접 열므로 --no-verify-jwt 로 배포한다
// ① GET ?provider=naver|kakao&to=android|ios|<웹 주소>&cc=<challenge>  → 서명한 state + 쿠키 nonce 를 들고 제공자 로그인 화면으로
// ② GET ?code=…&state=…  (제공자가 돌려보냄)   → 회원 식별값으로 계정 찾기/만들기 → 일회용 로그인 토큰을 social_handoff 에 보관
//                                                → <돌아갈 곳>#sl_code=<교환 코드>  (토큰은 주소에 싣지 않는다 — 보안 감사 #1)
// ③ POST { action:'exchange', code, verifier }  → sha256(verifier) 가 cc 와 같을 때만 { tokenHash } (앱이 verifyOtp 로 세션을 받는다)
//    같은 코드를 또 쓰거나 verifier 가 틀리면 코드가 샌 것 → 그 계정의 모든 세션을 끊는다
// 계정은 이메일이 아니라 제공자 회원 식별값(HMAC)으로 찾는다. 카카오는 이메일을 받지 않는다
import { admin, cors, json } from '../_shared/supabase.ts'
import { blindIndex, encrypt, signState, verifyState } from '../_shared/crypto.ts'
import { NO_MAIL_DOMAIN, authorizeUrl, fetchIdentity, returnUrl, type Provider } from '../_shared/providers.ts'

// 로그인 CSRF 방지: 시작한 브라우저에만 nonce 쿠키를 심고, 돌아왔을 때 state 안의 nonce 와 맞춘다
const COOKIE = 'sl_nonce'
const cookie = (v: string, age: number) => `${COOKIE}=${v}; Path=/functions/v1/social-login; Max-Age=${age}; HttpOnly; Secure; SameSite=Lax`
// cc = base64url(sha256(verifier)), verifier·교환 코드 = base64url(32바이트). 모두 43자
const B64URL43 = /^[A-Za-z0-9_-]{43}$/
const HANDOFF_TTL_MS = 120_000
const b64url = (b: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(b))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
const sha256 = async (s: string) => b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))
const redirect = (url: string, setCookie: string) =>
  new Response(null, { status: 302, headers: { Location: url, 'Set-Cookie': setCookie, 'Cache-Control': 'no-store' } })
const page = (msg: string) =>
  new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><p style="font:16px system-ui;padding:24px">${msg}</p>`,
    { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method === 'POST') return exchange(req)
  const q = new URL(req.url).searchParams

  // ① 시작
  if (!q.has('state')) {
    const provider = q.get('provider')
    const to = q.get('to') ?? ''
    const cc = q.get('cc') ?? ''
    if ((provider !== 'naver' && provider !== 'kakao') || !returnUrl(to) || !B64URL43.test(cc)) return page('잘못된 로그인 요청이에요.')
    const nonce = crypto.randomUUID()
    try {
      return redirect(authorizeUrl(provider, await signState({ provider, to, nonce, cc })), cookie(nonce, 600))
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
    if (typeof s.cc !== 'string' || !B64URL43.test(s.cc)) return fail('state_expired')
    const code = b64url(crypto.getRandomValues(new Uint8Array(32)))
    const { error: hoErr } = await db.from('social_handoff').insert({
      code_hash: await sha256(code), challenge: s.cc, user_id: uid, token_hash: link.properties.hashed_token,
      expires_at: new Date(Date.now() + HANDOFF_TTL_MS).toISOString(),
    })
    if (hoErr) throw hoErr
    // cc 는 공개값(해시)이라 실어도 된다. 앱이 어느 verifier 로 교환할지 고르는 데 쓴다
    return redirect(`${back}#sl_code=${code}&cc=${s.cc}`, cookie('', 0))
  } catch (e) {
    console.error('social_login_failed', provider, (e as Error).message) // 토큰·식별값은 남기지 않는다
    return fail('social_failed')
  }
})

// ③ 교환: 로그인을 시작한 기기만 verifier 를 갖고 있다. 주소의 sl_code 만 가로챈 앱은 여기서 막힌다
async function exchange(req: Request) {
  const body = await req.json().catch(() => ({}))
  const code = body?.code, verifier = body?.verifier
  if (body?.action !== 'exchange' || typeof code !== 'string' || typeof verifier !== 'string' || !B64URL43.test(code) || !B64URL43.test(verifier)) {
    return json({ error: 'bad_request' }, 400)
  }
  const db = admin()
  const { data, error } = await db.rpc('take_social_handoff', { p_code_hash: await sha256(code), p_challenge: await sha256(verifier) })
  if (error) { console.error('social_handoff_failed', error.message); return json({ error: 'social_failed' }, 500) }
  const r = (data as { result: string; user_id: string | null; token_hash: string | null }[])[0]
  if (r?.result === 'ok' && r.token_hash) return json({ tokenHash: r.token_hash })
  if (r?.result === 'reused' && r.user_id) {
    // 코드가 두 번 쓰였거나 다른 기기가 냈다 = 누군가 코드를 손에 넣었다. 이미 만들어진 세션까지 모두 끊는다
    console.error('social_handoff_reused') // 사용자 식별값은 남기지 않는다
    const { error: rvErr } = await db.rpc('revoke_user_sessions', { p_uid: r.user_id })
    if (rvErr) console.error('social_handoff_revoke_failed', rvErr.message)
  }
  return json({ error: 'state_expired' }, 400)
}
