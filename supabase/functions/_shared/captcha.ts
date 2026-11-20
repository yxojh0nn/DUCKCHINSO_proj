// Cloudflare Turnstile 서버 검증 (앱 위젯이 준 토큰이 진짜인지 Cloudflare 에 묻는다)
// TURNSTILE_SECRET 이 없으면 막는다(fail-closed, 보안 감사 #4). 키 교체·새 환경에서 빠져도 조용히 열리지 않게
// 캡차 없이 돌릴 로컬·테스트 환경만 CAPTCHA_DISABLED=1 로 명시해 끈다. 운영에는 절대 넣지 않는다
export async function verifyCaptcha(token: unknown, ip: string) {
  const secret = Deno.env.get('TURNSTILE_SECRET')
  if (!secret) {
    if (Deno.env.get('CAPTCHA_DISABLED') === '1') return true
    console.error('captcha_misconfigured') // 운영에서 보이면 TURNSTILE_SECRET 등록
    return false
  }
  if (typeof token !== 'string' || !token || token.length > 2048) return false
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret, response: token, remoteip: ip }),
  }).catch(() => null)
  const data = await res?.json().catch(() => null) as { success?: boolean } | null
  return data?.success === true
}
