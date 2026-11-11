import { useEffect, useRef } from 'react'

// Cloudflare Turnstile 캡차 (보안 점검 M2·M5). Supabase Auth 의 CAPTCHA 를 켜면
// 비회원 시작(signInAnonymously)·이메일 로그인·비밀번호 재설정에 토큰이 필요하다.
// VITE_TURNSTILE_SITE_KEY 가 비어 있으면 아무것도 그리지 않는다 → 캡차 켜기 전에 이 코드를 먼저 배포해도 된다
const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined
export const captchaOn = !!SITE_KEY

type Turnstile = {
  render(el: HTMLElement, o: Record<string, unknown>): string
  remove(id: string): void
}
declare global { interface Window { turnstile?: Turnstile } }

let loading: Promise<void> | null = null
const load = () => loading ??= new Promise((resolve, reject) => {
  const s = document.createElement('script')
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
  s.async = true
  s.onload = () => resolve()
  s.onerror = () => { loading = null; reject(new Error('captcha_load_failed')) }
  document.head.appendChild(s)
})

// 토큰은 한 번만 쓸 수 있다. 요청이 실패하면 부모가 key 를 바꿔 다시 그린다
export function Captcha({ onToken }: { onToken: (token: string | null) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const cb = useRef(onToken)
  cb.current = onToken
  useEffect(() => {
    if (!SITE_KEY || !ref.current) return
    const el = ref.current
    let id: string | undefined
    let gone = false
    load().then(() => {
      if (gone || !window.turnstile) return
      id = window.turnstile.render(el, {
        sitekey: SITE_KEY,
        callback: (t: string) => cb.current(t),
        'expired-callback': () => cb.current(null),
        'error-callback': () => cb.current(null),
      })
    }).catch(() => cb.current(null))
    return () => { gone = true; if (id) window.turnstile?.remove(id) }
  }, [])
  return SITE_KEY ? <div ref={ref} className="mt-3 flex min-h-[65px] justify-center" /> : null
}
