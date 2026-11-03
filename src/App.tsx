import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'
import { BottomNav } from '@/components/BottomNav'
import { Toast } from '@/components/ui/Toast'
import Consent from '@/screens/Consent'
import ArtistSetup from '@/screens/ArtistSetup'
import Home from '@/screens/Home'
import ConcertDetail from '@/screens/ConcertDetail'
import Match from '@/screens/Match'
import ChatList from '@/screens/ChatList'
import ChatRoom from '@/screens/ChatRoom'
import Me from '@/screens/Me'
import EditArtists from '@/screens/EditArtists'

// 진입 순서 강제: 동의 → 임시 계정 → 아티스트 지정 → 홈 (기획서 5.1)
function Gate() {
  const accountId = useAppStore((s) => s.accountId)
  const setupDone = useAppStore((s) => s.setupDone)
  const { pathname } = useLocation()
  if (!accountId) return <Navigate to="/consent" replace />
  if (!setupDone && pathname !== '/setup') return <Navigate to="/setup" replace />
  return <Outlet />
}

function TabLayout() {
  return (
    <div className="flex min-h-full flex-col">
      <main className="flex flex-1 flex-col">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}

export default function App() {
  return (
    // 데스크톱에서는 휴대폰 폭으로 가운데 표시
    <div className="flex h-full justify-center md:items-center md:bg-mist md:py-8">
      <div className="relative h-full w-full max-w-[430px] overflow-hidden bg-paper md:h-[min(880px,100%)] md:rounded-[44px] md:shadow-[0_0_0_10px_var(--ink),0_30px_60px_-20px_rgba(0,0,0,0.35)]">
        <div className="h-full overflow-y-auto">
          <Routes>
            <Route path="/consent" element={<Consent />} />
            <Route element={<Gate />}>
              <Route path="/setup" element={<ArtistSetup />} />
              <Route element={<TabLayout />}>
                <Route path="/" element={<Home />} />
                <Route path="/match" element={<Match />} />
                <Route path="/chats" element={<ChatList />} />
                <Route path="/me" element={<Me />} />
              </Route>
              <Route path="/concert/:id" element={<ConcertDetail />} />
              <Route path="/chats/:id" element={<ChatRoom />} />
              <Route path="/me/artists" element={<EditArtists />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        <Toast />
      </div>
    </div>
  )
}
