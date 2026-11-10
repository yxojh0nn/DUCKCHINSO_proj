import { useEffect, useRef } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Capacitor } from '@capacitor/core'
import { App as CapApp } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { api } from '@/api'
import { AppBar, BottomNav } from '@/components/BottomNav'
import { SplitView, splitOf, useWide, type SplitGroup } from '@/components/Split'
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
import LoginIdSetup from '@/screens/auth/LoginIdSetup'
import FindAccount from '@/screens/auth/FindAccount'
import PasswordChange from '@/screens/my/PasswordChange'
import LegalPage from '@/screens/legal/LegalPage'
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
import Reports from '@/screens/admin/Reports'
import ReportDetail from '@/screens/admin/ReportDetail'
import Inquiries from '@/screens/admin/Inquiries'
import InquiryDetail from '@/screens/admin/InquiryDetail'
import Words from '@/screens/admin/Words'

// 로그인·동의가 끝나야 들어갈 수 있는 화면 묶음
function Gate({ children }: { children?: React.ReactNode }) {
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
  // 이메일로 가입한 사람은 아이디를 만들어야 다음으로 (docs/로그인_계정_암호화_설계.md 5장)
  if (me.data?.consentsOk && me.data.needsLoginId && pathname !== '/login-id') return <Navigate to="/login-id" replace />
  // 회원은 첫 로그인 때 메인 화면 전에 닉네임·프로필을 정한다 (비회원은 커뮤니티 첫 진입 때)
  if (me.data?.consentsOk && !me.data.needsLoginId && !me.data.isGuest && !me.data.profileSetupDone && pathname !== '/community/setup') {
    return <Navigate to="/community/setup" replace />
  }
  return children ?? <Outlet />
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

// 앱: 로그인 후 커스텀 스킴으로 돌아온다. 구글·애플·메일은 ?code=… → 세션으로 교환,
// 네이버·카카오는 #token_hash=…(또는 #error=…) → AuthCallback 이 처리
function useNativeAuthReturn() {
  const nav = useNavigate()
  useEffect(() => {
    if (!Capacitor.isNativePlatform() || !supabase) return
    const sub = CapApp.addListener('appUrlOpen', async ({ url }) => {
      const u = new URL(url)
      const code = u.searchParams.get('code')
      if (!code && !/token_hash=|error=/.test(u.hash)) return
      await Browser.close().catch(() => {})
      if (code) await supabase!.auth.exchangeCodeForSession(code)
      const next = u.searchParams.get('next')
      nav({ pathname: '/auth/callback', search: next ? `?next=${next}` : '', hash: code ? '' : u.hash }, { replace: true })
    })
    return () => { sub.then((s) => s.remove()) }
  }, [nav])
}

// 일반 화면 전환 방향: 뒤로 가기(POP)는 왼쪽에서, 나머지는 오른쪽에서 들어온다
// 탭끼리 옮길 때는 하단 바를 고정한 채 Tabs 안에서만 움직이도록 같은 key 를 쓴다
// 두 칸(split)일 때는 목록이 그대로 있고 오른쪽 칸만 바뀌므로 묶음 전체에 같은 key 를 쓴다
function usePageTransition(split?: SplitGroup) {
  const { pathname } = useLocation()
  const type = useNavigationType()
  const key = split ? `split:${split.list}` : TAB_PATHS.includes(pathname) ? 'tabs' : pathname
  // 화면이 바뀔 때만 방향을 정한다 (탭끼리 옮길 때 class 가 바뀌면 하단 바까지 다시 움직임)
  const last = useRef({ key: '', cls: '' })
  if (last.current.key !== key) last.current = { key, cls: type === 'POP' ? 'slide-left' : 'slide-right' }
  return last.current
}

// 1024px 이상에서 목록·상세 두 칸으로 보여 줄 묶음. 주소는 휴대폰과 같다
const SPLITS: SplitGroup[] = [
  { list: '/chats', detail: '/chats/:id', List: ChatList, Detail: ChatRoom, empty: '대화방을 골라 주세요' },
  { list: '/community', detail: '/community/post/:id', List: Community, Detail: PostDetail, empty: '글을 골라 주세요' },
  { list: '/calendar', detail: '/concert/:id', List: CalendarScreen, Detail: ConcertDetail, empty: '공연을 골라 주세요' },
  { list: '/admin/reports', detail: '/admin/reports/:id', List: Reports, Detail: ReportDetail, empty: '신고를 골라 주세요', admin: true },
  { list: '/admin/inquiries', detail: '/admin/inquiries/:id', List: Inquiries, Detail: InquiryDetail, empty: '문의를 골라 주세요', admin: true },
  { list: '/admin/review', detail: '/admin/concerts/:id', List: ReviewList, Detail: ConcertReview, empty: '검수할 공연을 골라 주세요', admin: true },
]

export default function App() {
  const theme = useUI((s) => s.theme)
  const session = useSession()
  const themed = useRef(false)
  useEffect(() => { applyTheme(theme, themed.current); themed.current = true }, [theme])
  useLiveSync(session.data)
  useNativeAuthReturn()
  const { pathname } = useLocation()
  const wide = useWide()
  const split = wide ? splitOf(SPLITS, pathname) : undefined
  const page = usePageTransition(split)
  // 앱 바(768px 이상)는 로그인한 화면에서만. 로그인·동의·공개 문서에는 없다
  const auth = /^\/($|login|auth|consent)/.test(pathname) // 로그인·동의: 768px 이상에서 가운데 카드(최대 440px)
  const showBar = !!session.data && !auth && !pathname.startsWith('/legal')

  return (
    // 화면 폭: ~767px 한 줄(431px부터 최대 560px 가운데), 768px 이상 앱 바 + 햄버거 서랍 + 본문 최대 640px (docs/반응형_레이아웃_설계.md)
    <div className="flex h-full flex-col bg-paper">
      {showBar && <AppBar />}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div className="h-full overflow-y-auto overflow-x-hidden overscroll-contain">
          <div key={page.key} className={`mx-auto h-full w-full max-w-[560px] ${auth ? 'md:flex md:max-w-[440px] md:items-center md:py-8' : split ? 'max-w-[1100px]' : 'md:max-w-[640px]'} ${page.cls}`}>
          <div className={`h-full w-full ${auth ? 'md:h-[min(760px,100%)] md:overflow-y-auto md:rounded-[20px] md:border md:border-hairline' : ''}`}>
          {split ? <Gate>{split.admin ? <AdminGate><SplitView group={split} /></AdminGate> : <SplitView group={split} />}</Gate> : (
          <Routes>
            <Route path="/" element={<Splash />} />
            <Route path="/login" element={<Login />} />
            <Route path="/login/member" element={<MemberLogin />} />
            <Route path="/login/email" element={<EmailAuth />} />
            <Route path="/login/find" element={<FindAccount />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/consent" element={<Consent />} />
            <Route path="/legal/:doc" element={<LegalPage />} />
            <Route element={<Gate />}>
              <Route element={<Tabs />}>
                <Route path="/calendar" element={<CalendarScreen />} />
                <Route path="/community" element={<Community />} />
                <Route path="/chats" element={<ChatList />} />
                <Route path="/my" element={<My />} />
              </Route>
              <Route path="/login-id" element={<LoginIdSetup />} />
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
              <Route path="/my/password" element={<PasswordChange />} />
              <Route path="/my/inquiry" element={<Inquiry />} />
              <Route path="/my/withdraw" element={<Withdraw />} />
              <Route element={<AdminGate />}>
                <Route path="/admin" element={<AdminHome />} />
                <Route path="/admin/review" element={<ReviewList />} />
                <Route path="/admin/concerts/:id" element={<ConcertReview />} />
                <Route path="/admin/inbox" element={<InboxSearch />} />
                <Route path="/admin/artists" element={<Artists />} />
                <Route path="/admin/artists/:id" element={<ArtistEdit />} />
                <Route path="/admin/reports" element={<Reports />} />
                <Route path="/admin/reports/:id" element={<ReportDetail />} />
                <Route path="/admin/inquiries" element={<Inquiries />} />
                <Route path="/admin/inquiries/:id" element={<InquiryDetail />} />
                <Route path="/admin/words" element={<Words />} />
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          )}
          </div>
          </div>
        </div>
        <Toast />
      </div>
    </div>
  )
}
