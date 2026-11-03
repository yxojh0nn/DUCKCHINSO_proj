import { NavLink } from 'react-router-dom'
import { useRequests, useRooms } from '@/lib/queries'
import { IconCalendar, IconChat, IconCommunity, IconMy } from './icons'
import { Badge } from './ui/Badge'

type ItemProps = { to: string; label: string; Icon: typeof IconCalendar; badge?: number }

function Item({ to, label, Icon, badge = 0 }: ItemProps) {
  return (
    <NavLink to={to} className={({ isActive }) => `relative flex flex-1 flex-col items-center gap-0.5 pb-1.5 pt-2 text-[10.5px] font-medium ${isActive ? 'text-ink' : 'text-graphite'}`}>
      {({ isActive }) => (
        <>
          <Icon size={26} filled={isActive} strokeWidth={isActive ? 1.9 : 1.6} />
          {label}
          {badge > 0 && <Badge count={badge} className="absolute left-1/2 top-1 ml-2" />}
          {badge > 0 && <span className="sr-only">, 새 알림 {badge}개</span>}
        </>
      )}
    </NavLink>
  )
}

// 하단 앱 바 (인앱 상세 기획: 공연·캘린더 / 커뮤니티 / 채팅 / MY)
export function BottomNav() {
  const rooms = useRooms()
  const requests = useRequests()
  const unread = rooms.data?.reduce((n, r) => n + r.unread, 0) ?? 0
  const incoming = requests.data?.filter((r) => r.direction === 'in').length ?? 0
  return (
    <nav aria-label="주요 메뉴" className="sticky bottom-0 z-20 flex border-t border-hairline bg-paper/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <Item to="/calendar" label="공연·캘린더" Icon={IconCalendar} />
      <Item to="/community" label="커뮤니티" Icon={IconCommunity} badge={incoming} />
      <Item to="/chats" label="채팅" Icon={IconChat} badge={unread} />
      <Item to="/my" label="MY" Icon={IconMy} />
    </nav>
  )
}
