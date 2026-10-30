import { NavLink } from 'react-router-dom'
import { useAppStore, isExpired } from '@/store/useAppStore'

const icons = {
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  match: 'M9 11a3 3 0 100-6 3 3 0 000 6zM17 11a3 3 0 100-6 3 3 0 000 6zM3 20c0-3 3-5 6-5s6 2 6 5M14 15.5c.9-.3 2-.5 3-.5 3 0 5 2 5 5',
  chat: 'M4 5h16v11H9l-5 4z',
  me: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 4-6 8-6s8 2 8 6',
}

function Item({ to, label, icon, badge }: { to: string; label: string; icon: keyof typeof icons; badge?: number }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) => `relative flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${isActive ? 'text-accent font-semibold' : 'text-muted'}`}
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d={icons[icon]} /></svg>
      {label}
      {!!badge && <span className="absolute right-[28%] top-1 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] leading-4 text-white">{badge}</span>}
    </NavLink>
  )
}

// 홈 하단 페이지 이동 버튼 (기획서 5.2)
export function BottomNav() {
  const requests = useAppStore((s) => s.requests)
  const now = useAppStore((s) => s.now)()
  const incoming = requests.filter((r) => r.to === 'me' && r.status === 'pending' && !isExpired(r, now)).length
  return (
    <nav className="sticky bottom-0 z-20 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)]">
      <Item to="/" label="캘린더" icon="calendar" />
      <Item to="/match" label="매칭" icon="match" badge={incoming} />
      <Item to="/chats" label="채팅" icon="chat" />
      <Item to="/me" label="내 정보" icon="me" />
    </nav>
  )
}
