import { useNavigate } from 'react-router-dom'
import { IconBack } from './icons'
import { useInSplitDetail } from './Split'

type Props = { title?: React.ReactNode; back?: boolean | (() => void); right?: React.ReactNode; large?: boolean }

// large: 탭 첫 화면의 큰 제목. 아니면 뒤로 가기가 있는 얇은 상단 바
export function AppHeader({ title, back, right, large }: Props) {
  const nav = useNavigate()
  if (useInSplitDetail()) back = undefined
  if (large) {
    return (
      // 휴대폰은 탭 위에 로고 줄(App.tsx Tabs)이 안전 영역을 맡는다
      <header className="flex items-end justify-between gap-3 px-5 pb-2 pt-2 md:pt-[max(44px,calc(env(safe-area-inset-top)+20px))]">
        <h1 className="t-large">{title}</h1>
        <div className="flex items-center">{right}</div>
      </header>
    )
  }
  return (
    <header className="sticky top-0 z-20 grid grid-cols-[minmax(44px,1fr)_auto_minmax(44px,1fr)] items-center bg-paper/90 px-1 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
      <div>
        {back && (
          <button onClick={() => (typeof back === 'function' ? back() : nav(-1))} aria-label="뒤로" className="flex h-11 w-11 items-center justify-center active:opacity-50">
            <IconBack />
          </button>
        )}
      </div>
      <h1 className="truncate t-head">{title}</h1>
      <div className="flex justify-end">{right}</div>
    </header>
  )
}

// 상단 바 오른쪽 아이콘 버튼 (44px 터치 영역)
export function HeaderButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button aria-label={label} onClick={onClick} className="relative flex h-11 w-11 items-center justify-center active:opacity-50">
      {children}
    </button>
  )
}
