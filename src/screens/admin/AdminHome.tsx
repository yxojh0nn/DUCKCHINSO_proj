import { useQuery } from '@tanstack/react-query'
import { api } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { MenuGroup, MenuRow } from '@/components/MenuRow'
import { IconBlock, IconCalendar, IconFlag, IconFriends, IconInfo, IconInquiry, IconMy, IconSearch, IconTicket } from '@/components/icons'
import { Badge } from '@/components/ui/Badge'
import { adminKeys } from './AdminGate'

// MY > 관리자: 전체 사용자 · 신고 · 문의 · 검수 대기 공연 · 예매일 제보 · 공연 찾기 · 아티스트 · 비속어
export default function AdminHome() {
  const review = useQuery({ queryKey: adminKeys.review, queryFn: () => api.adminReviewConcerts() })
  const reports = useQuery({ queryKey: adminKeys.reports, queryFn: () => api.adminReports() })
  const inquiries = useQuery({ queryKey: adminKeys.inquiries, queryFn: () => api.adminInquiries() })
  const tips = useQuery({ queryKey: adminKeys.tips, queryFn: () => api.adminTicketTips() })
  const openReports = reports.data?.filter((r) => r.status === 'open').length ?? 0
  const openInquiries = inquiries.data?.filter((i) => i.status === 'open').length ?? 0
  return (
    <>
      <AppHeader back title="관리자" />
      <MenuGroup title="사용자">
        <MenuRow icon={<IconFriends />} label="전체 사용자" to="/admin/users" />
        <MenuRow icon={<IconFlag />} label="신고" to="/admin/reports" right={<Badge count={openReports} />} />
        <MenuRow icon={<IconInquiry />} label="문의" to="/admin/inquiries" right={<Badge count={openInquiries} />} />
      </MenuGroup>
      <MenuGroup title="공지">
        <MenuRow icon={<IconInfo />} label="공지 올리기" to="/admin/notice" />
      </MenuGroup>
      <MenuGroup title="공연">
        <MenuRow icon={<IconCalendar />} label="검수 대기 공연" to="/admin/review"
          right={<Badge count={review.data?.length ?? 0} />} />
        <MenuRow icon={<IconTicket />} label="예매일 제보" to="/admin/tips"
          right={<Badge count={tips.data?.filter((t) => t.status === 'pending').length ?? 0} />} />
        <MenuRow icon={<IconSearch />} label="공연 찾기" to="/admin/inbox" />
      </MenuGroup>
      <MenuGroup title="데이터">
        <MenuRow icon={<IconMy />} label="아티스트" to="/admin/artists" />
        <MenuRow icon={<IconBlock />} label="비속어" to="/admin/words" />
      </MenuGroup>
    </>
  )
}
