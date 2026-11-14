import { useRef } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BottomNav, TAB_PATHS } from '@/components/BottomNav'
import { Wordmark } from '@/screens/auth/Wordmark'

// 가로로 스크롤되는 영역(칩 줄, 사진 줄 등) 안에서 시작한 밀기는 탭 전환으로 보지 않는다
const inHorizontalScroller = (el: EventTarget | null, root: HTMLElement) => {
  for (let n = el as HTMLElement | null; n && n !== root; n = n.parentElement) {
    if (n.scrollWidth > n.clientWidth && /auto|scroll/.test(getComputedStyle(n).overflowX)) return true
  }
  return false
}

export function Tabs() {
  const nav = useNavigate()
  const { pathname } = useLocation()
  const index = TAB_PATHS.indexOf(pathname)
  // 탭이 바뀔 때만 방향을 정한다 (다시 그려질 때 애니메이션이 재시작되지 않게)
  // 밀어서 바꿀 때만 미끄러진다: 하단 탭을 누르면 같은 높이의 화면이라 바로 바꾸는 편이 빠르다
  const swiped = useRef(false)
  const last = useRef({ index, dir: 'right', slide: false })
  if (last.current.index !== index) {
    last.current = { index, dir: index > last.current.index ? 'right' : 'left', slide: swiped.current }
    swiped.current = false
  }
  const { dir, slide } = last.current
  const start = useRef<{ x: number; y: number } | null>(null)

  // 모바일: 좌우로 밀어 이전·다음 탭으로
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    // 휴대폰 폭에서만 (768px 이상 터치 화면은 서랍 메뉴를 쓴다)
    start.current = e.touches.length === 1 && !window.matchMedia('(min-width: 768px)').matches && !inHorizontalScroller(e.target, e.currentTarget as HTMLElement) ? { x: t.clientX, y: t.clientY } : null
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = start.current
    start.current = null
    if (!s || index < 0) return
    const t = e.changedTouches[0]
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.5) return
    const next = TAB_PATHS[index + (dx < 0 ? 1 : -1)]
    if (next) { swiped.current = true; nav(next) }
  }

  return (
    <div className="flex min-h-full flex-col">
      {/* 휴대폰: 탭 화면 맨 위 가운데 로고 (768px 이상은 앱 바에 있다) */}
      <div className="flex justify-center pb-1 pt-[max(10px,env(safe-area-inset-top))] md:hidden"><Wordmark small /></div>
      <main key={pathname} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
        className={`flex flex-1 flex-col ${!slide ? '' : dir === 'right' ? 'slide-right' : 'slide-left'}`}>
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
