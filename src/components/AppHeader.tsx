import { useNavigate } from 'react-router-dom'

type Props = { title: string; back?: boolean; right?: React.ReactNode; large?: boolean }

// large: 탭 첫 화면의 큰 제목. 아니면 뒤로 가기가 있는 얇은 상단 바
export function AppHeader({ title, back, right, large }: Props) {
  const nav = useNavigate()
  if (large) {
    return (
      <header className="flex items-end justify-between gap-3 px-5 pb-2 pt-12">
        <h1 className="t-large">{title}</h1>
        {right}
      </header>
    )
  }
  return (
    <header className="sticky top-0 z-20 grid h-11 grid-cols-[1fr_auto_1fr] items-center border-b border-hairline/60 bg-paper/85 px-2 backdrop-blur-xl">
      <div>
        {back && (
          <button onClick={() => nav(-1)} aria-label="뒤로" className="flex h-11 items-center pl-1 pr-3 text-ink active:opacity-50">
            <svg viewBox="0 0 12 20" className="h-[18px] w-[11px]" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2L2 10l8 8" /></svg>
          </button>
        )}
      </div>
      <h1 className="truncate t-head">{title}</h1>
      <div className="flex justify-end">{right}</div>
    </header>
  )
}
