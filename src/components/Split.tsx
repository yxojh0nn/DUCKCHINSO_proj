import { createContext, useContext, useSyncExternalStore } from 'react'
import { Route, Routes, matchPath, useLocation } from 'react-router-dom'

// 1024px 이상인지. 넓으면 목록·상세 두 칸으로 보여 준다 (docs/반응형_레이아웃_설계.md 5장)
const WIDE = '(min-width: 1024px)'
export function useWide() {
  return useSyncExternalStore(
    (cb) => { const m = window.matchMedia(WIDE); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb) },
    () => window.matchMedia(WIDE).matches,
    () => false,
  )
}

// 두 칸의 상세 칸 안인지. 상세 칸에서는 뒤로 가기를 숨긴다 (목록이 옆에 있으므로)
const InDetail = createContext(false)
export const useInSplitDetail = () => useContext(InDetail)

export type SplitGroup = { list: string; detail: string; List: () => React.ReactNode; Detail: () => React.ReactNode; empty: string; admin?: boolean }

export const splitOf = (groups: SplitGroup[], pathname: string) =>
  groups.find((g) => g.list === pathname || matchPath(g.detail, pathname))

// 왼쪽: 목록(380px, 계속 떠 있음) / 오른쪽: 주소에 맞는 상세. 주소는 휴대폰과 같다
export function SplitView({ group }: { group: SplitGroup }) {
  const { pathname } = useLocation()
  const { List, Detail } = group
  return (
    <div className="flex h-full">
      <aside className="h-full w-[380px] shrink-0 overflow-y-auto border-r border-hairline">
        <List />
      </aside>
      <section className="h-full min-w-0 flex-1 overflow-y-auto">
        <InDetail.Provider value={true}>
          <div key={pathname} className="mx-auto h-full max-w-[720px] [animation:fade-in_140ms_ease-out]">
            <Routes>
              <Route path={group.detail} element={<Detail />} />
              <Route path="*" element={<p className="flex h-full items-center justify-center t-body text-graphite">{group.empty}</p>} />
            </Routes>
          </div>
        </InDetail.Provider>
      </section>
    </div>
  )
}
