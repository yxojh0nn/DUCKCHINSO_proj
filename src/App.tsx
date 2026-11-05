import { useEffect, useRef } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { api } from '@/api'
import { BottomNav } from '@/components/BottomNav'
import { Toast } from '@/components/ui/Toast'
import { supabase } from '@/lib/supabase'
import { keys, useLiveSync, useMe, useSession } from '@/lib/queries'
import { applyTheme, useUI } from '@/store/ui'
import Splash from '@/screens/auth/Splash'
import Login from '@/screens/auth/Login'
import MemberLogin from '@/screens/auth/MemberLogin'
import EmailAuth from '@/screens/auth/EmailAuth'
import Consent from '@/screens/auth/Consent'
import AuthCallback from '@/screens/auth/AuthCallback'
import CalendarScreen from '@/screens/calendar/CalendarScreen'
import Search from '@/screens/calendar/Search'
import ConcertDetail from '@/screens/calendar/ConcertDetail'
import Community from '@/screens/community/Community'
import CommunityRules from '@/screens/community/CommunityRules'
import ProfileSetup from '@/screens/community/ProfileSetup'
import Requests from '@/screens/community/Requests'
import PostDetail from '@/screens/community/PostDetail'
import PostWrite from '@/screens/community/PostWrite'
import ProfileView from '@/screens/community/ProfileView'
import ChatList from '@/screens/chat/ChatList'
import ChatRoom from '@/screens/chat/ChatRoom'
import My from '@/screens/my/My'
import Settings from '@/screens/my/Settings'
import ConsentHistory from '@/screens/my/ConsentHistory'
import OpenApiInfo from '@/screens/my/OpenApiInfo'
import Friends from '@/screens/my/Friends'
import MyInfo from '@/screens/my/MyInfo'
import ProfileEdit from '@/screens/my/ProfileEdit'
import Prefs from '@/screens/my/Prefs'
import Favorites from '@/screens/my/Favorites'
import Reviews from '@/screens/my/Reviews'
import Inquiry from '@/screens/my/Inquiry'
import Withdraw from '@/screens/my/Withdraw'
import AdminGate from '@/screens/admin/AdminGate'
import AdminHome from '@/screens/admin/AdminHome'
import ReviewList from '@/screens/admin/ReviewList'
import ConcertReview from '@/screens/admin/ConcertReview'
import InboxSearch from '@/screens/admin/InboxSearch'
import Artists from '@/screens/admin/Artists'
import ArtistEdit from '@/screens/admin/ArtistEdit'

// 로그인·동의가 끝나야 들어갈 수 있는 화면 묶음
function Gate() {
  const session = useSession()
  const me = useMe()
  const qc = useQueryClient()
  const { pathname } = useLocation()
  const pending = useUI((s) => s.pendingConsents)
  const setPending = useUI((s) => s.setPendingConsents)
  const saving = useRef(false)

  // 이메일 가입 때 받은 동의를 계정이 생긴 직후 한 번 저장
  useEffect(() => {
    if (!me.data || me.data.consentsOk || !pending || saving.current) return
    saving.current = true
    // 새 동의 값이 반영된 me 를 받은 뒤에 pending 을 비운다 (먼저 비우면 동의 화면으로 잘못 튕김)
    api.saveConsents(pending)
      .then(() => qc.invalidateQueries({ queryKey: keys.me }))
      .then(() => setPending(null))
      .finally(() => { saving.current = false })
  }, [me.data, pending, setPending, qc])

  if (session.isLoading) return null
  if (!session.data) return <Navigate to="/login" replace />
  if (me.isLoading || (me.data && !me.data.consentsOk && pending)) return null
  if (me.isError) return <Navigate to="/login" replace />
  if (me.data && !me.data.consentsOk && pathname !== '/consent') return <Navigate to="/consent" replace />
  return <Outlet />
}

const TAB_PATHS = ['/calendar', '/community', '/chats', '/my']

// 가로로 스크롤되는 영역(칩 줄, 사진 줄 등) 안에서 시작한 밀기는 탭 전환으로 보지 않는다
const inHorizontalScroller = (el: EventTarget | null, root: HTMLElement) => {
  for (let n = el as HTMLElement | null; n && n !== root; n = n.parentElement) {
    if (n.scrollWidth > n.clientWidth && /auto|scroll/.test(getComputedStyle(n).overflowX)) return true
  }
  return false
}

function Tabs() {
  const nav = useNavigate()
  const { pathname } = useLocation()
  const index = TAB_PATHS.indexOf(pathname)
  // 탭이 바뀔 때만 방향을 정한다 (다시 그려질 때 애니메이션이 재시작되지 않게)
  const last = useRef({ index, dir: 'right' })
  if (last.current.index !== index) last.current = { index, dir: index > last.current.index ? 'right' : 'left' }
  const dir = last.current.dir
  const start = useRef<{ x: number; y: number } | null>(null)

  // 모바일: 좌우로 밀어 이전·다음 탭으로
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    start.current = e.touches.length === 1 && !inHorizontalScroller(e.target, e.currentTarget as HTMLElement) ? { x: t.clientX, y: t.clientY } : null
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
    if (next) nav(next)
  }

  return (
    <div className="flex min-h-full flex-col">
      <main key={pathname} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}
        className={`flex flex-1 flex-col ${dir === 'right' ? 'slide-right' : 'slide-left'}`}>
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}

// 앱: 소셜 로그인 후 커스텀 스킴(com.duckchinso.app://auth/callback?code=…)으로 돌아오면 세션으로 교환
function useNativeAuthReturn() {
  const nav = useNavigate()
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !supabase) return
    const sub = CapApp.addListener('appUrlOpen', async ({ url }) => {
      const code = new URL(url).searchParams.get('code')
      if (!code) return
      await Browser.close().catch(() => {})
      await supabase!.auth.exchangeCodeForSession(code)
      nav('/auth/callback', { replace: true })
    })
    return () => { sub.then((s) => s.remove()) }
  }, [nav])
}

// 일반 화면 전환 방향: 뒤로 가기(POP)는 왼쪽에서, 나머지는 오른쪽에서 들어온다
// 탭끼리 옮길 때는 하단 바를 고정한 채 Tabs 안에서만 움직이도록 같은 key 를 쓴다
function usePageTransition() {
  const { pathname } = useLocation()
  const type = useNavigationType()
  const key = TAB_PATHS.includes(pathname) ? 'tabs' : pathname
  // 화면이 바뀔 때만 방향을 정한다 (탭끼리 옮길 때 class 가 바뀌면 하단 바까지 다시 움직임)
  const last = useRef({ key: '', cls: '' })
  if (last.current.key !== key) last.current = { key, cls: type === 'POP' ? 'slide-left' : 'slide-right' }
  return last.current
}

export default function App() {
  const theme = useUI((s) => s.theme)
  const session = useSession()
  const themed = useRef(false)
  useEffect(() => { applyTheme(theme, themed.current); themed.current = true }, [theme])
  useLiveSync(session.data)
  useNativeAuthReturn()
  const page = usePageTransition()

  return (
    // 데스크톱 웹에서는 휴대폰 폭으로 가운데 표시
    <div className="flex h-full justify-center md:items-center md:bg-mist md:py-8">
      <div className="relative h-full w-full max-w-[430px] overflow-hidden bg-paper md:h-[min(900px,100%)] md:rounded-[40px] md:border md:border-hairline">
        <div className="h-full overflow-y-auto overflow-x-hidden overscroll-contain">
          <div key={page.key} className={`h-full ${page.cls}`}>
          <Routes>
            <Route path="/" element={<Splash />} />
            <Route path="/login" element={<Login />} />
            <Route path="/login/member" element={<MemberLogin />} />
            <Route path="/login/email" element={<EmailAuth />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/consent" element={<Consent />} />
            <Route element={<Gate />}>
              <Route element={<Tabs />}>
                <Route path="/calendar" element={<CalendarScreen />} />
                <Route path="/community" element={<Community />} />
                <Route path="/chats" element={<ChatList />} />
                <Route path="/my" element={<My />} />
              </Route>
              <Route path="/search" element={<Search />} />
              <Route path="/concert/:id" element={<ConcertDetail />} />
              <Route path="/community/rules" element={<CommunityRules />} />
              <Route path="/community/setup" element={<ProfileSetup />} />
              <Route path="/community/requests" element={<Requests />} />
              <Route path="/community/write" element={<PostWrite />} />
              <Route path="/community/post/:id" element={<PostDetail />} />
              <Route path="/profile/:id" element={<ProfileView />} />
              <Route path="/chats/:id" element={<ChatRoom />} />
              <Route path="/my/settings" element={<Settings />} />
              <Route path="/my/settings/consents" element={<ConsentHistory />} />
              <Route path="/my/settings/api" element={<OpenApiInfo />} />
              <Route path="/my/friends" element={<Friends />} />
              <Route path="/my/info" element={<MyInfo />} />
              <Route path="/my/info/profile" element={<ProfileEdit />} />
              <Route path="/my/info/prefs" element={<Prefs />} />
              <Route path="/my/info/favorites" element={<Favorites />} />
              <Route path="/my/info/reviews" element={<Reviews />} />
              <Route path="/my/inquiry" element={<Inquiry />} />
              <Route path="/my/withdraw" element={<Withdraw />} />
              <Route element={<AdminGate />}>
                <Route path="/admin" element={<AdminHome />} />
                <Route path="/admin/review" element={<ReviewList />} />
                <Route path="/admin/concerts/:id" element={<ConcertReview />} />
                <Route path="/admin/inbox" element={<InboxSearch />} />
                <Route path="/admin/artists" element={<Artists />} />
                <Route path="/admin/artists/:id" element={<ArtistEdit />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </div>
        </div>
        <Toast />
      </div>
    </div>
  )
}
