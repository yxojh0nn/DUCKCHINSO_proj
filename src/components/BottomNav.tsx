import { NavLink } from 'react-router-dom'
import { useAppStore, isExpired } from '@/store/useAppStore'

const icons = {
  calendar: 'M4.5 6.5h15v13h-15zM4.5 10.5h15M8.5 3.5v4M15.5 3.5v4',
  match: 'M9 11.5a3.25 3.25 0 100-6.5 3.25 3.25 0 000 6.5zM16.5 11a2.75 2.75 0 100-5.5 2.75 2.75 0 000 5.5zM3 19.5c.4-3.2 3-5.2 6-5.2s5.6 2 6 5.2M15 14.6c.5-.1 1-.2 1.5-.2 2.6 0 4.6 1.7 5 4.6',
  chat: 'M12 4.5c4.7 0 8 3 8 6.8s-3.3 6.7-8 6.7c-1 0-1.9-.1-2.7-.4L5 19.5l1-3.4c-1.4-1.2-2-2.9-2-4.8 0-3.8 3.3-6.8 8-6.8z',
  me: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4.5 20.5c.6-3.8 3.7-6 7.5-6s6.9 2.2 7.5 6',
}

function Item({ to, label, icon, badge }: { to: string; label: string; icon: keyof typeof icons; badge?: number }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) => `relative flex flex-1 flex-col items-center gap-0.5 pb-1 pt-1.5 text-[10px] font-medium ${isActive ? 'text-ink' : 'text-graphite/80'}`}
    >
      {({ isActive }) => (
        <>
          <svg viewBox="0 0 24 24" className="h-[26px] w-[26px]" fill={isActive ? 'currentColor' : 'none'} fillOpacity={isActive ? 0.12 : 0} stroke="currentColor" strokeWidth={isActive ? 1.9 : 1.6} strokeLinecap="round" strokeLinejoin="round">
            <path d={icons[icon]} />
          </svg>
          {label}
          {!!badge && (
            <span className="absolute left-1/2 top-0.5 ml-1.5 min-w-[18px] rounded-full bg-rose px-1 text-center text-[11px] font-semibold leading-[18px] text-paper num">
              {badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

// 하단 페이지 이동 버튼 (기획서 5.2)
export function BottomNav() {
  const requests = useAppStore((s) => s.requests)
  const now = useAppStore((s) => s.now)()
  const incoming = requests.filter((r) => r.to === 'me' && r.status === 'pending' && !isExpired(r, now)).length
  return (
    <nav className="sticky bottom-0 z-20 flex border-t border-hairline/60 bg-paper/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
      <Item to="/" label="캘린더" icon="calendar" />
      <Item to="/match" label="매칭" icon="match" badge={incoming} />
      <Item to="/chats" label="채팅" icon="chat" />
      <Item to="/me" label="내 정보" icon="me" />
    </nav>
  )
}
