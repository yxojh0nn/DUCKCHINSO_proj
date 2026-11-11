// Cloudflare Turnstile 서버 검증 (앱 위젯이 준 토큰이 진짜인지 Cloudflare 에 묻는다)
// TURNSTILE_SECRET 이 없으면 통과 — 캡차를 아직 켜지 않은 환경(로컬·테스트)용. 운영에는 반드시 등록한다
export async function verifyCaptcha(token: unknown, ip: string) {
  const secret = Deno.env.get('TURNSTILE_SECRET')
  if (!secret) return true
  if (typeof token !== 'string' || !token || token.length > 2048) return false
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret, response: token, remoteip: ip }),
  }).catch(() => null)
  const data = await res?.json().catch(() => null) as { success?: boolean } | null
  return data?.success === true
}
