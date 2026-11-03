import { Link } from 'react-router-dom'
import { IconChevron } from './icons'

type Props = { icon?: React.ReactNode; label: string; to?: string; onClick?: () => void; danger?: boolean; right?: React.ReactNode }

// 설정 목록의 한 줄. 상자 없이 아이콘 + 글자 + 꺾쇠
export function MenuRow({ icon, label, to, onClick, danger, right }: Props) {
  const inner = (
    <>
      {icon && <span className={danger ? 'text-danger' : 'text-ink'}>{icon}</span>}
      <span className={`flex-1 t-body ${danger ? 'text-danger' : ''}`}>{label}</span>
      {right ?? (to && <IconChevron size={18} className="text-graphite" />)}
    </>
  )
  const cls = 'flex min-h-[52px] w-full items-center gap-3.5 px-5 text-left active:bg-mist'
  return (
    <li>
      {to ? <Link to={to} className={cls}>{inner}</Link>
        : onClick ? <button onClick={onClick} className={cls}>{inner}</button>
          : <div className={cls}>{inner}</div>}
    </li>
  )
}

export function MenuGroup({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 first:mt-2">
      {title && <h2 className="px-5 pb-1 t-sub font-semibold text-graphite">{title}</h2>}
      <ul>{children}</ul>
    </section>
  )
}
