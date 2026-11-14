import { useEffect, useRef } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/api'
import { keys, useMe, useSession } from '@/lib/queries'
import { useUI } from '@/store/ui'

// 프로필 설정 전에도 볼 수 있는 화면 (공연 보기는 프로필 없이 된다)
const CALENDAR_PATHS = ['/calendar', '/concert/', '/search', '/legal/']

// 로그인·동의가 끝나야 들어갈 수 있는 화면 묶음
export function Gate({ children }: { children?: React.ReactNode }) {
  const session = useSession()
  const me = useMe()
  const qc = useQueryClient()
  const { pathname, search } = useLocation()
  const pending = useUI((s) => s.pendingConsents)
  const setPending = useUI((s) => s.setPendingConsents)
  const saving = useRef(false)

  // 이메일 가입 때 받은 동의를 계정이 생긴 직후 한 번 저장
  useEffect(() => {
    if (!me.data || me.data.consentsOk || !pending || saving.current) return
    saving.current = true
    // 새 동의 값이 반영된 me 를 받은 뒤에 pending 을 비운다 (먼저 비우면 동의 화면으로 잘못 튕김)
    api.saveConsents(pending)
      .then(() => qc.invalidateQueries({ queryKey: keys.me }))
      .then(() => setPending(null))
      .finally(() => { saving.current = false })
  }, [me.data, pending, setPending, qc])

  if (session.isLoading) return null
  if (!session.data) return <Navigate to="/login" replace />
  if (me.isLoading || (me.data && !me.data.consentsOk && pending)) return null
  if (me.isError) return <Navigate to="/login" replace />
  if (me.data && !me.data.consentsOk && pathname !== '/consent') return <Navigate to="/consent" replace />
  // 이메일로 가입한 사람은 아이디를 만들어야 다음으로 (docs/로그인_계정_암호화_설계.md 5장)
  if (me.data?.consentsOk && me.data.needsLoginId && pathname !== '/login-id') return <Navigate to="/login-id" replace />
  // 회원도 프로필(닉네임·아티스트)은 공연 캘린더를 먼저 본 뒤, 커뮤니티·채팅·MY에 처음 들어갈 때 정한다 (비회원은 커뮤니티 첫 진입 때)
  // 마치면 가려던 화면(from, 검색어 포함)으로 돌아간다
  if (me.data?.consentsOk && !me.data.needsLoginId && !me.data.isGuest && !me.data.profileSetupDone
      && pathname !== '/community/setup' && !CALENDAR_PATHS.some((p) => pathname.startsWith(p))) {
    return <Navigate to="/community/setup" replace state={{ from: pathname + search }} />
  }
  return children ?? <Outlet />
}
