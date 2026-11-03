import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '@/lib/queries'
import { Wordmark } from './Wordmark'

// 타이틀 화면 → 로그인 화면 (로그인돼 있으면 바로 캘린더)
export default function Splash() {
  const nav = useNavigate()
  const session = useSession()
  useEffect(() => {
    if (session.isLoading) return
    const t = setTimeout(() => nav(session.data ? '/calendar' : '/login', { replace: true }), 900)
    return () => clearTimeout(t)
  }, [session.isLoading, session.data, nav])
  return (
    <div className="flex h-full flex-col items-center justify-center [animation:fade-in_400ms_ease-out]">
      <Wordmark />
      <p className="mt-3 t-sub text-graphite">J-pop 공연 캘린더와 덕질 친구</p>
    </div>
  )
}
