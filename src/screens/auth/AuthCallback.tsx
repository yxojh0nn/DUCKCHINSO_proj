import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api, errorText } from '@/api'
import { keys } from '@/lib/queries'
import { toast } from '@/store/ui'
import { takeLoginNonce } from '@/lib/loginNonce'

// 같은 토큰을 두 번 쓰지 않게 (개발 모드에서 effect 가 두 번 돈다)
const used = new Set<string>()

// 소셜 로그인·메일 인증에서 돌아오는 주소. 세션이 잡히면 캘린더로 (동의·아이디가 없으면 Gate가 그 화면으로 보냄)
// 네이버·카카오는 #token_hash=… (실패하면 #error=…), 구글·애플·메일 인증은 ?code=… (supabase-js 가 처리)
// ?next=password: 비밀번호 재설정 메일에서 왔다 → 새 비밀번호 화면으로
export default function AuthCallback() {
  const nav = useNavigate()
  const qc = useQueryClient()
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1))
    const next = new URLSearchParams(window.location.search).get('next') === 'password' ? '/my/password' : '/calendar'
    const tokenHash = hash.get('token_hash')
    const err = hash.get('error')
    if (tokenHash || err) window.history.replaceState(null, '', window.location.pathname) // 주소창에 토큰을 남기지 않는다
    if (err) {
      toast(errorText(new Error(err)))
      nav('/login/member', { replace: true })
      return
    }
    if (tokenHash && !used.has(tokenHash)) {
      used.add(tokenHash)
      // 이 기기에서 시작한 로그인이 아니면(남이 보낸 링크 등) 토큰을 쓰지 않는다
      if (!takeLoginNonce(hash.get('cn'))) {
        toast(errorText(new Error('state_expired')))
        nav('/login/member', { replace: true })
        return
      }
      api.completeSocialLogin(tokenHash).catch((e) => toast(errorText(e)))
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
