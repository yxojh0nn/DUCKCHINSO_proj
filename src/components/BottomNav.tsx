import { useRef, useState } from 'react'
import { useDialogFocus } from './ui/a11y'
import { Link, NavLink } from 'react-router-dom'
import { useRequests, useRooms } from '@/lib/queries'
import { Wordmark } from '@/screens/auth/Wordmark'
import { IconCalendar, IconChat, IconClose, IconCommunity, IconMenu, IconMy } from './icons'
import { Badge } from './ui/Badge'

// 주요 메뉴: 휴대폰은 아래 탭 바, 768px 이상은 앱 바의 햄버거 서랍. 이름·경로·배지를 둘이 같이 쓴다
const ITEMS = [
  { to: '/calendar', label: '공연·캘린더', Icon: IconCalendar, badge: 'none' },
  { to: '/community', label: '커뮤니티', Icon: IconCommunity, badge: 'requests' },
  { to: '/chats', label: '채팅', Icon: IconChat, badge: 'unread' },
  { to: '/my', label: 'MY', Icon: IconMy, badge: 'none' },
] as const
// 탭 화면 주소 (밀어서 탭 넘기기·화면 전환이 같이 쓴다)
export const TAB_PATHS: string[] = ITEMS.map((i) => i.to)

function useBadges() {
  const rooms = useRooms()
  const requests = useRequests()
  return {
    none: 0,
    unread: rooms.data?.reduce((n, r) => n + r.unread, 0) ?? 0,
    requests: requests.data?.filter((r) => r.direction === 'in').length ?? 0,
  }
}

// 하단 앱 바 (인앱 상세 기획: 공연·캘린더 / 커뮤니티 / 채팅 / MY). 768px 이상에서는 숨기고 서랍을 쓴다
export function BottomNav() {
  const badges = useBadges()
  return (
    <nav aria-label="주요 메뉴" className="sticky bottom-0 z-20 flex border-t border-hairline bg-paper/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      {ITEMS.map(({ to, label, Icon, badge }) => {
        const n = badges[badge]
        return (
          <NavLink key={to} to={to} className={({ isActive }) => `relative flex flex-1 flex-col items-center gap-0.5 pb-1.5 pt-2 text-[11px] font-medium ${isActive ? 'text-ink' : 'text-graphite'}`}>
            {({ isActive }) => (
              <>
                <Icon size={26} filled={isActive} strokeWidth={isActive ? 1.9 : 1.6} />
                {label}
                {n > 0 && <Badge count={n} className="absolute left-1/2 top-1 ml-2" />}
                {n > 0 && <span className="sr-only">, 새 알림 {n}개</span>}
              </>
            )}
          </NavLink>
        )
      })}
    </nav>
  )
}

// 768px 이상: 맨 위 앱 바. 햄버거를 누르면 왼쪽에서 메뉴 서랍이 열린다
export function AppBar() {
  const badges = useBadges()
  const [open, setOpen] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const first = useRef<HTMLAnchorElement>(null)
  const total = badges.unread + badges.requests

  useDialogFocus(open, () => setOpen(false), first, button) // 닫으면 초점은 햄버거 버튼으로

  return (
    <header className="hidden h-14 shrink-0 items-center gap-1 border-b border-hairline bg-paper px-2 md:flex">
      <button ref={button} onClick={() => setOpen(true)} aria-label={total ? `메뉴 열기, 새 알림 ${total}개` : '메뉴 열기'}
        aria-expanded={open} aria-controls="nav-drawer" className="relative flex h-11 w-11 items-center justify-center rounded-full hover:bg-mist">
        <IconMenu />
        {total > 0 && <span aria-hidden className="absolute right-2 top-2 h-2 w-2 rounded-full bg-notice" />}
      </button>
      <Link to="/calendar" aria-label="덕친소 홈" className="px-1"><Wordmark small /></Link>

      {open && (
        <div className="fixed inset-0 z-50 [animation:fade-in_140ms_ease-out]">
          <button aria-label="메뉴 닫기" tabIndex={-1} onClick={() => setOpen(false)} className="absolute inset-0 bg-black/35" />
          <nav id="nav-drawer" role="dialog" aria-modal="true" aria-label="주요 메뉴"
            className="absolute inset-y-0 left-0 flex w-[280px] flex-col bg-paper shadow-[0_0_24px_rgba(0,0,0,0.15)] [animation:drawer-in_200ms_cubic-bezier(.2,.9,.25,1)]">
            <div className="flex h-14 items-center justify-between border-b border-hairline pl-4 pr-2">
              <Wordmark small />
              <button onClick={() => setOpen(false)} aria-label="메뉴 닫기" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-mist"><IconClose /></button>
            </div>
            <ul className="flex flex-col gap-1 p-2">
              {ITEMS.map(({ to, label, Icon, badge }, i) => {
                const n = badges[badge]
                return (
                  <li key={to}>
                    <NavLink ref={i === 0 ? first : undefined} to={to} onClick={() => setOpen(false)}
                      className={({ isActive }) => `flex h-12 items-center gap-3 rounded-[10px] px-3 t-body ${isActive ? 'bg-mist font-semibold text-ink' : 'text-graphite hover:bg-mist'}`}>
                      {({ isActive }) => (
                        <>
                          <Icon size={24} filled={isActive} strokeWidth={isActive ? 1.9 : 1.6} />
                          <span className="flex-1">{label}</span>
                          <Badge count={n} />
                          {n > 0 && <span className="sr-only">, 새 알림 {n}개</span>}
                        </>
                      )}
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </nav>
        </div>
      )}
    </header>
  )
}
