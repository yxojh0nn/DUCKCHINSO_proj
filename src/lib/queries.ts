import { useEffect, useState } from 'react'
import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Membership } from '@/api'
import { APP_SETTINGS, nicknameError } from '@/lib/settings'

export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
})

export const keys = {
  session: ['session'] as const,
  me: ['me'] as const,
  genres: ['genres'] as const,
  artists: ['artists'] as const,
  concerts: ['concerts'] as const,
  rooms: ['rooms'] as const,
  messages: (id: string) => ['messages', id] as const,
  requests: ['requests'] as const,
  friends: ['friends'] as const,
  blocked: ['blocked'] as const,
  recommend: ['recommend'] as const,
  profile: (id: string) => ['profile', id] as const,
  posts: (f: object) => ['posts', f] as const,
  post: (id: string) => ['post', id] as const,
  comments: (id: string) => ['comments', id] as const,
  notices: ['notices'] as const,
  inquiries: ['inquiries'] as const,
  membership: ['membership'] as const,
  attendance: ['attendance'] as const,
  dailyPhotos: ['dailyPhotos'] as const,
  recaps: (id: string) => ['recaps', id] as const,
  recapPublic: ['recapPublic'] as const,
  badge: (id: string) => ['badge', id] as const,
  notice: (id: string) => ['notice', id] as const,
}

export const useSession = () => useQuery({ queryKey: keys.session, queryFn: () => api.sessionUserId(), staleTime: Infinity })
export const useMe = () => {
  const s = useSession()
  return useQuery({ queryKey: keys.me, queryFn: () => api.getMe(), enabled: !!s.data })
}
// 내 멤버십. 비회원·불러오기 전에는 무료 한도로 본다 (실제 한도는 DB 트리거가 건다)
//   member = 후원(구독) 중. 앱의 후원/미후원 구분은 이것만 본다 (판정은 서버 is_subscriber, 결제 실패 유예 기간 포함)
const FREE: Membership = { tier: 'free', subStartedAt: null, subUntil: null, maxArtists: APP_SETTINGS.maxArtists, maxGenres: APP_SETTINGS.maxGenres, months: null, autoRenew: true,
  platform: null, methodLabel: null, nextChargeAt: null, nextAmountKrw: null, pastDue: false }
export const useMembership = () => {
  const me = useMe().data
  const q = useQuery({ queryKey: keys.membership, queryFn: () => api.myMembership(), enabled: !!me && !me.isGuest })
  const m = q.data ?? FREE
  return { ...q, m, member: m.tier === 'subscriber' }
}
// 내가 다녀온 공연 (회원만, 비회원은 빈 목록)
export const useAttendance = () => {
  const me = useMe().data
  return useQuery({ queryKey: keys.attendance, queryFn: () => api.myAttendance(), enabled: !!me && !me.isGuest })
}
export const useDailyPhotos = () => {
  const me = useMe().data
  return useQuery({ queryKey: keys.dailyPhotos, queryFn: () => api.myDailyPhotos(), enabled: !!me && !me.isGuest })
}
// 리캡 재료: 본인은 내 기록 그대로(늘 보임), 남은 서버가 공개 여부를 판단
export const useRecapSource = (userId: string | undefined) => {
  const me = useMe().data
  const self = !!me && me.id === userId
  const mine = useAttendance()
  const other = useQuery({ queryKey: keys.recaps(userId ?? ''), queryFn: () => api.userRecaps(userId!), enabled: !!userId && !self })
  return self ? { data: mine.data ? { visible: true, records: mine.data } : undefined, isLoading: mine.isLoading } : other
}
export const useRecapPublic = (enabled = true) => useQuery({ queryKey: keys.recapPublic, queryFn: () => api.myRecapPublic(), enabled })
export const useMemberBadge = (userId: string | undefined) =>
  useQuery({ queryKey: keys.badge(userId ?? ''), queryFn: () => api.memberBadge(userId!), enabled: !!userId, staleTime: 600_000 })
// 닉네임 미리 확인: 입력이 0.4초 멈추면, 형식이 맞고 지금 내 닉네임과 다를 때만 서버에 묻는다. 겹치면 true
export const useNicknameTaken = (nickname: string, current: string | undefined) => {
  const n = nickname.trim()
  const [asked, setAsked] = useState(n)
  useEffect(() => { const t = setTimeout(() => setAsked(n), 400); return () => clearTimeout(t) }, [n])
  const q = useQuery({ queryKey: ['nicknameAvailable', asked], queryFn: () => api.nicknameAvailable(asked),
    enabled: !!asked && asked !== current && !nicknameError(asked), staleTime: 10_000 })
  return asked === n && q.data === false
}

export const useGenres = () => useQuery({ queryKey: keys.genres, queryFn: () => api.listGenres(), staleTime: Infinity })
// id 목록 → 이름 목록 (목록에 없는 id·빈 이름은 뺀다). 아티스트·장르 공용
export const namesOf = <K,>(list: { id: K; name: string }[] | undefined, ids: K[]) =>
  ids.map((id) => list?.find((x) => x.id === id)?.name).filter((n): n is string => !!n)
export const useArtists = () => useQuery({ queryKey: keys.artists, queryFn: () => api.listArtists(), staleTime: 600_000 })
export const useConcerts = () => useQuery({ queryKey: keys.concerts, queryFn: () => api.listConcerts(), staleTime: 300_000 })
export const useRooms = () => useQuery({ queryKey: keys.rooms, queryFn: () => api.listRooms() })
export const useNotices = () => useQuery({ queryKey: keys.notices, queryFn: () => api.listNotices() })
// 이 사람이 관리자인가 (커뮤니티 '관리자' 표시). 목록은 거의 안 바뀌어 한 번 받아 둔다
export const useAdminIds = () => useQuery({ queryKey: ['admin-ids'], queryFn: () => api.adminIds(), staleTime: Infinity }).data ?? []
export const useIsAdmin = (userId: string) => useAdminIds().includes(userId)
export const useRequests =() => useQuery({ queryKey: keys.requests, queryFn: () => api.listRequests() })

// 로그인 상태 변화와 실시간 이벤트를 캐시 무효화로 연결한다 (앱 최상단에서 한 번)
export function useLiveSync(userId: string | null | undefined) {
  const qc = useQueryClient()
  useEffect(() => api.onAuthChange((id) => {
    qc.setQueryData(keys.session, id)
    if (!id) qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'session' })
    else qc.invalidateQueries({ queryKey: keys.me })
  }), [qc])
  useEffect(() => {
    if (!userId) return
    return api.subscribe((e) => {
      if (e.type === 'message') {
        qc.invalidateQueries({ queryKey: keys.rooms })
        qc.invalidateQueries({ queryKey: keys.messages(e.roomId) })
      } else if (e.type === 'notice') {
        qc.invalidateQueries({ queryKey: keys.notices })
      } else {
        qc.invalidateQueries({ queryKey: keys.requests })
        qc.invalidateQueries({ queryKey: keys.rooms })
        qc.invalidateQueries({ queryKey: keys.friends })
        qc.invalidateQueries({ queryKey: ['profile'] })
      }
    })
  }, [qc, userId])
}
