import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/api'
import { keys } from '@/lib/queries'

// 소셜 로그인·메일 인증에서 돌아오는 주소. 세션이 잡히면 캘린더로 (동의가 없으면 Gate가 동의 화면으로 보냄)
export default function AuthCallback() {
  const nav = useNavigate()
  const qc = useQueryClient()
  useEffect(() => {
    let tries = 0
    const t = setInterval(async () => {
      const id = await api.sessionUserId()
      if (id || ++tries > 20) {
        clearInterval(t)
        qc.setQueryData(keys.session, id)
        nav(id ? '/calendar' : '/login', { replace: true })
      }
    }, 250)
    return () => clearInterval(t)
  }, [nav, qc])
  return <p className="flex h-full items-center justify-center t-body text-graphite">로그인하는 중…</p>
}
