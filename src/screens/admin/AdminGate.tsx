import { Navigate, Outlet } from 'react-router-dom'
import { useMe } from '@/lib/queries'

export const adminKeys = {
  review: ['admin', 'review'] as const,
  concert: (id: string) => ['admin', 'concert', id] as const,
  inbox: (q: string) => ['admin', 'inbox', q] as const,
  artists: (q: string) => ['admin', 'artists', q] as const,
}

// 운영자 화면 묶음. 화면만 막는 것이고, 실제 권한은 DB(RLS·is_admin())가 확인한다
export default function AdminGate() {
  const me = useMe()
  if (me.isLoading) return null
  if (!me.data?.isAdmin) return <Navigate to="/my" replace />
  return <Outlet />
}
