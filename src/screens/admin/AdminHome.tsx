import { useQuery } from '@tanstack/react-query'
import { api } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { MenuGroup, MenuRow } from '@/components/MenuRow'
import { IconCalendar, IconMy, IconSearch } from '@/components/icons'
import { Badge } from '@/components/ui/Badge'
import { adminKeys } from './AdminGate'

// MY > 운영자: 검수 대기 공연 · 공연 찾기 · 아티스트
export default function AdminHome() {
  const review = useQuery({ queryKey: adminKeys.review, queryFn: () => api.adminReviewConcerts() })
  return (
    <>
      <AppHeader back title="운영자" />
      <MenuGroup title="공연">
        <MenuRow icon={<IconCalendar />} label="검수 대기 공연" to="/admin/review"
          right={<span className="flex items-center gap-2"><Badge count={review.data?.length ?? 0} /></span>} />
        <MenuRow icon={<IconSearch />} label="공연 찾기" to="/admin/inbox" />
      </MenuGroup>
      <MenuGroup title="데이터">
        <MenuRow icon={<IconMy />} label="아티스트" to="/admin/artists" />
      </MenuGroup>
    </>
  )
}
