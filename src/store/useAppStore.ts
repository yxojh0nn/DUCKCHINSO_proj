import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { AUTO_REPLIES, MOCK_USERS } from '@/data/mock'
import { CONSENT_VERSION } from '@/data/consent'
import { APP_SETTINGS } from '@/lib/settings'
import { DAY_MS, kstDayKey } from '@/lib/date'

// Supabase 연결 전 임시 상태 저장소. 브라우저 localStorage에만 남는다.

export type MatchRequest = {
  id: string
  from: string // 'me' 또는 상대 ID
  to: string
  createdAt: number
  expiresAt: number
  status: 'pending' | 'accepted' | 'declined'
}

export type Message = { id: string; from: 'me' | 'them' | 'system'; text: string; at: number }

export type ChatRoom = {
  id: string
  partnerId: string
  createdAt: number
  partnerLeftAt: number | null
  hiddenAt: number | null
  messages: Message[]
}

type State = {
  consents: Record<string, boolean> | null
  consentVersion: string | null
  accountId: string | null
  nickname: string
  setupDone: boolean
  myArtists: string[]
  region: string | null
  regionPublic: boolean
  requests: MatchRequest[]
  rooms: ChatRoom[]
  blocks: { userId: string; at: number }[]
  reports: { userId: string; reason: string; at: number }[]
  timeOffset: number // 데모: 시간 앞당기기
  toast: string | null
}

type Actions = {
  now: () => number
  acceptConsent: (c: Record<string, boolean>) => void
  setArtists: (ids: string[]) => void
  finishSetup: () => void
  setRegion: (r: string | null) => void
  setRegionPublic: (v: boolean) => void
  todaySentCount: () => number
  sendRequest: (userId: string) => 'ok' | 'limit' | 'dup'
  respond: (requestId: string, accept: boolean) => void
  sendMessage: (roomId: string, text: string) => void
  leaveRoom: (roomId: string) => void
  hideRoom: (roomId: string) => void
  block: (userId: string) => void
  unblock: (userId: string) => void
  report: (userId: string, reason: string) => void
  showToast: (msg: string | null) => void
  demoAdvanceDay: () => void
  demoPartnerLeave: (roomId: string) => void
  demoIncoming: () => void
  reset: () => void
}

const uid = () => Math.random().toString(36).slice(2, 10)

const initial: State = {
  consents: null,
  consentVersion: null,
  accountId: null,
  nickname: '',
  setupDone: false,
  myArtists: [],
  region: null,
  regionPublic: true,
  requests: [],
  rooms: [],
  blocks: [],
  reports: [],
  timeOffset: 0,
  toast: null,
}

const newRoom = (partnerId: string, at: number): ChatRoom => ({
  id: uid(), partnerId, createdAt: at, partnerLeftAt: null, hiddenAt: null,
  messages: [{ id: uid(), from: 'system', text: '서로 수락해 대화방이 열렸어요. 개인 연락처·계좌 요구에 주의하세요.', at }],
})

export const isExpired = (r: MatchRequest, now: number) => r.status === 'pending' && r.expiresAt <= now

export const useAppStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      ...initial,

      now: () => Date.now() + get().timeOffset,

      // 동의 → 임시(익명) 계정 생성. 실제로는 Supabase signInAnonymously + consents 저장
      acceptConsent: (c) => {
        const t = get().now()
        const expires = t + APP_SETTINGS.requestExpireDays * DAY_MS
        const leftRoom = newRoom('u8', t - DAY_MS)
        leftRoom.messages.push(
          { id: uid(), from: 'them', text: '원오크 내한 가세요?', at: t - DAY_MS + 60_000 },
          { id: uid(), from: 'me', text: '네 스탠딩 노리고 있어요!', at: t - DAY_MS + 120_000 },
        )
        leftRoom.partnerLeftAt = t - 3_600_000
        set({
          consents: c,
          consentVersion: CONSENT_VERSION,
          accountId: `anon_${uid()}`,
          nickname: `익명의 팬${Math.floor(1000 + Math.random() * 9000)}`,
          // 데모용 받은 요청 2건과 상대가 나간 대화방 1개
          requests: [
            { id: uid(), from: 'u6', to: 'me', createdAt: t - 3_600_000, expiresAt: expires - 3_600_000, status: 'pending' },
            { id: uid(), from: 'u7', to: 'me', createdAt: t - 2 * DAY_MS, expiresAt: expires - 2 * DAY_MS, status: 'pending' },
          ],
          rooms: [leftRoom],
        })
      },

      setArtists: (ids) => set({ myArtists: ids.slice(0, APP_SETTINGS.maxArtists) }),
      finishSetup: () => set({ setupDone: true }),
      setRegion: (r) => set({ region: r }),
      setRegionPublic: (v) => set({ regionPublic: v }),

      todaySentCount: () => {
        const today = kstDayKey(get().now())
        return get().requests.filter((r) => r.from === 'me' && kstDayKey(r.createdAt) === today).length
      },

      sendRequest: (userId) => {
        const s = get()
        const t = s.now()
        if (s.requests.some((r) => r.to === userId && r.status === 'pending' && !isExpired(r, t))) return 'dup'
        if (s.todaySentCount() >= APP_SETTINGS.dailyRequestLimit) return 'limit'
        const req: MatchRequest = {
          id: uid(), from: 'me', to: userId, createdAt: t,
          expiresAt: t + APP_SETTINGS.requestExpireDays * DAY_MS, status: 'pending',
        }
        set({ requests: [...s.requests, req] })
        // 데모: 수락하는 상대는 잠시 뒤 수락. 거절·만료는 알리지 않는다 (기획서 5.3)
        const user = MOCK_USERS.find((u) => u.id === userId)
        if (user?.willAccept) {
          setTimeout(() => {
            const cur = get()
            const r = cur.requests.find((x) => x.id === req.id)
            if (!r || r.status !== 'pending' || cur.blocks.some((b) => b.userId === userId)) return
            set({
              requests: cur.requests.map((x) => (x.id === req.id ? { ...x, status: 'accepted' } : x)),
              rooms: [newRoom(userId, cur.now()), ...cur.rooms],
              toast: `${user.nickname} 님이 대화 요청을 수락했어요`,
            })
          }, 2500)
        }
        return 'ok'
      },

      respond: (requestId, accept) => {
        const s = get()
        const req = s.requests.find((r) => r.id === requestId)
        if (!req) return
        set({
          requests: s.requests.map((r) => (r.id === requestId ? { ...r, status: accept ? 'accepted' : 'declined' } : r)),
          rooms: accept ? [newRoom(req.from, s.now()), ...s.rooms] : s.rooms,
        })
      },

      sendMessage: (roomId, text) => {
        const s = get()
        const room = s.rooms.find((r) => r.id === roomId)
        if (!room || room.partnerLeftAt) return
        const msg: Message = { id: uid(), from: 'me', text, at: s.now() }
        set({ rooms: s.rooms.map((r) => (r.id === roomId ? { ...r, hiddenAt: null, messages: [...r.messages, msg] } : r)) })
        setTimeout(() => {
          const cur = get()
          const rm = cur.rooms.find((r) => r.id === roomId)
          if (!rm || rm.partnerLeftAt || cur.blocks.some((b) => b.userId === rm.partnerId)) return
          const reply: Message = {
            id: uid(), from: 'them', at: cur.now(),
            text: AUTO_REPLIES[rm.messages.filter((m) => m.from === 'them').length % AUTO_REPLIES.length],
          }
          // 새 메시지가 오면 숨긴 방도 목록에 다시 보인다
          set({ rooms: cur.rooms.map((r) => (r.id === roomId ? { ...r, hiddenAt: null, messages: [...r.messages, reply] } : r)) })
        }, 1500)
      },

      // 내가 나가면 내 목록에서 사라지고, 상대 화면에는 퇴장 안내가 뜬다
      leaveRoom: (roomId) => set({ rooms: get().rooms.filter((r) => r.id !== roomId) }),

      // 숨기기: 내 목록에서만 사라짐, 상대는 모른다
      hideRoom: (roomId) => set({ rooms: get().rooms.map((r) => (r.id === roomId ? { ...r, hiddenAt: get().now() } : r)) }),

      // 차단: 상대에게 알리지 않는다. 해당 방과 대기 중 요청을 내 화면에서 정리
      block: (userId) => {
        const s = get()
        if (s.blocks.some((b) => b.userId === userId)) return
        set({
          blocks: [...s.blocks, { userId, at: s.now() }],
          rooms: s.rooms.filter((r) => r.partnerId !== userId),
          requests: s.requests.map((r) =>
            (r.from === userId || r.to === userId) && r.status === 'pending' ? { ...r, status: 'declined' } : r,
          ),
        })
      },
      unblock: (userId) => set({ blocks: get().blocks.filter((b) => b.userId !== userId) }),
      report: (userId, reason) => set({ reports: [...get().reports, { userId, reason, at: get().now() }] }),

      showToast: (msg) => set({ toast: msg }),

      demoAdvanceDay: () => set({ timeOffset: get().timeOffset + DAY_MS }),
      demoPartnerLeave: (roomId) => set({ rooms: get().rooms.map((r) => (r.id === roomId ? { ...r, partnerLeftAt: get().now() } : r)) }),
      demoIncoming: () => {
        const s = get()
        const t = s.now()
        const taken = new Set([
          ...s.requests.filter((r) => r.status === 'pending' && !isExpired(r, t)).flatMap((r) => [r.from, r.to]),
          ...s.rooms.map((r) => r.partnerId),
          ...s.blocks.map((b) => b.userId),
        ])
        const user = MOCK_USERS.find((u) => !taken.has(u.id))
        if (!user) return set({ toast: '요청을 보낼 수 있는 데모 사용자가 없어요' })
        set({
          requests: [...s.requests, {
            id: uid(), from: user.id, to: 'me', createdAt: t,
            expiresAt: t + APP_SETTINGS.requestExpireDays * DAY_MS, status: 'pending',
          }],
          toast: `${user.nickname} 님이 대화를 요청했어요`,
        })
      },
      reset: () => set({ ...initial }),
    }),
    {
      name: 'duckchinso-proto',
      partialize: ({ toast: _toast, ...rest }) => rest,
    },
  ),
)
