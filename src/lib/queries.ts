import { useEffect } from 'react'
import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api'

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
  notice: (id: string) => ['notice', id] as const,
}

export const useSession = () => useQuery({ queryKey: keys.session, queryFn: () => api.sessionUserId(), staleTime: Infinity })
export const useMe = () => {
  const s = useSession()
  return useQuery({ queryKey: keys.me, queryFn: () => api.getMe(), enabled: !!s.data })
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
