import { Navigate, Outlet } from 'react-router-dom'
import { useMe } from '@/lib/queries'

export const adminKeys = {
  review: ['admin', 'review'] as const,
  concert: (id: string) => ['admin', 'concert', id] as const,
  inbox: (q: string) => ['admin', 'inbox', q] as const,
  artists: (q: string) => ['admin', 'artists', q] as const,
  reports: ['admin', 'reports'] as const,
  inquiries: ['admin', 'inquiries'] as const,
  words: ['admin', 'words'] as const,
  contribs: (tab: string) => ['admin', 'contribs', tab] as const,
  clicks: (days: number) => ['admin', 'clicks', days] as const,
  users: (q: string, page: number, guests = false) => ['admin', 'users', q, page, guests] as const,
  userStats: ['admin', 'user-stats'] as const,
  user: (id: string) => ['admin', 'user', id] as const,
}

// 운영자 화면 묶음. 화면만 막는 것이고, 실제 권한은 DB(RLS·is_admin())가 확인한다
export default function AdminGate({ children }: { children?: React.ReactNode }) {
  const me = useMe()
  if (me.isLoading) return null
  if (!me.data?.isAdmin) return <Navigate to="/my" replace />
  return children ?? <Outlet />
}
