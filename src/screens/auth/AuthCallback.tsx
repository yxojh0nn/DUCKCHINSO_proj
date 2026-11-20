import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api, errorText } from '@/api'
import { keys } from '@/lib/queries'
import { toast } from '@/store/ui'
import { takeLoginVerifier } from '@/lib/loginNonce'

// 같은 코드를 두 번 쓰지 않게 (개발 모드에서 effect 가 두 번 돈다. 두 번 내면 서버가 공격으로 보고 세션을 끊는다)
const used = new Set<string>()

// 소셜 로그인·메일 인증에서 돌아오는 주소. 세션이 잡히면 캘린더로 (동의·아이디가 없으면 Gate가 그 화면으로 보냄)
// 네이버·카카오는 #sl_code=…&cc=… (실패하면 #error=…), 구글·애플·메일 인증은 ?code=… (supabase-js 가 처리)
// ?next=password: (예전) 비밀번호 재설정 메일에서 왔다 → 비밀번호 화면으로. 지금 재설정은 login-id 의 메일 코드로 한다
export default function AuthCallback() {
  const nav = useNavigate()
  const qc = useQueryClient()
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1))
    const next = new URLSearchParams(window.location.search).get('next') === 'password' ? '/my/password' : '/calendar'
    const slCode = hash.get('sl_code')
    const err = hash.get('error')
    if (slCode || err) window.history.replaceState(null, '', window.location.pathname) // 주소창에 코드를 남기지 않는다
    if (err) {
      toast(errorText(new Error(err)))
      nav('/login/member', { replace: true })
      return
    }
    if (slCode && !used.has(slCode)) {
      used.add(slCode)
      // 이 기기에서 시작한 로그인이 아니면(남이 보낸 링크 등) 서버에 보내지도 않는다
      const verifier = takeLoginVerifier(hash.get('cc'))
      if (!verifier) {
        toast(errorText(new Error('state_expired')))
        nav('/login/member', { replace: true })
        return
      }
      api.exchangeSocialCode(slCode, verifier).catch((e) => toast(errorText(e)))
    }
    let tries = 0
    const t = setInterval(async () => {
      const id = await api.sessionUserId()
      if (id || ++tries > 20) {
        clearInterval(t)
        qc.setQueryData(keys.session, id)
        nav(id ? next : '/login', { replace: true })
      }
    }, 250)
    return () => clearInterval(t)
  }, [nav, qc])
  return <p className="flex h-full items-center justify-center t-body text-graphite">로그인하는 중…</p>
}
