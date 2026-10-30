import { useNavigate } from 'react-router-dom'

type Props = { title: string; back?: boolean; right?: React.ReactNode }

export function AppHeader({ title, back, right }: Props) {
  const nav = useNavigate()
  return (
    <header className="sticky top-0 z-20 flex h-12 items-center gap-2 border-b border-line bg-surface/95 px-3 backdrop-blur">
      {back && (
        <button onClick={() => nav(-1)} aria-label="뒤로" className="-ml-1 rounded-lg p-1.5 text-muted hover:bg-chip">
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
      )}
      <h1 className="flex-1 truncate text-[17px] font-bold">{title}</h1>
      {right}
    </header>
  )
}
