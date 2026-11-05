// 화면이 쓰는 데이터 모양과 백엔드 계약. Supabase(supabaseApi)와 데모(demoApi)가 같은 계약을 구현한다

export type Genre = { id: number; name: string }
export type Artist = { id: string; name: string; nameJa: string | null; nameEn: string | null }

export type TicketLink = { vendor: string; url: string }
export type Concert = {
  id: string
  title: string
  posterUrl: string | null
  venue: string
  venueQuery: string
  region: string | null
  priceText: string | null
  priceMin: number | null
  priceMax: number | null
  ticketOpenAt: string | null // ISO
  genreId: number | null
  artistIds: string[]
  schedules: string[] // ISO, 오름차순
  links: TicketLink[]
}

export type UserCard = { id: string; nickname: string; bio: string; avatarUrl: string | null }

export type Profile = UserCard & {
  bannerUrl: string | null
  isGuest: boolean
  profileSetupDone: boolean
  communityAgreedAt: string | null
  notifyEnabled: boolean
}

export type Me = Profile & {
  artistIds: string[]
  genreIds: number[]
  favoriteIds: string[]
  consents: Record<string, boolean> // 항목별 최신 동의 값 (현재 약관 버전 기준)
  consentsOk: boolean // 필수 항목 모두 현재 버전으로 동의했는가
  email: string | null
  isAdmin: boolean // 운영자 메뉴 표시용. 실제 권한은 DB(RLS·is_admin())가 확인한다
}

// 운영자 화면
export type AdminConcert = {
  id: string
  kopisId: string | null
  title: string
  posterUrl: string | null
  venue: string
  region: string | null
  schedules: string[]
  status: 'published' | 'review' | 'hidden'
  score: number | null
  reasons: string[] // 자동 판별 근거 ("내한 +2" 등)
  visit: boolean | null
  cast: string | null
  promoter: string | null
  artistIds: string[]
  ticketOpenAt: string | null
}
export type InboxItem = {
  kopisId: string
  title: string
  venue: string
  startDate: string | null
  endDate: string | null
  concert: { id: string; status: AdminConcert['status'] } | null // 이미 가져온 공연
}
export type AdminArtist = Artist & { aliases: string[]; source: 'admin' | 'musicbrainz' }
export type SanctionLevel = 'warning' | 'suspend' | 'ban'
export type AdminReport = {
  id: string
  reason: ReportReason
  detail: string | null
  snapshot: string | null // 신고 시점 원문 (내용이 지워져도 남는다)
  status: 'open' | 'resolved' | 'dismissed'
  createdAt: string
  resolvedAt: string | null
  kind: 'post' | 'comment' | 'message' | 'profile'
  postId: string | null
  reporter: { id: string; nickname: string } | null
  target: { id: string; nickname: string; status: 'active' | 'suspended' | 'banned' } | null
  priorSanctions: number
}
export type AdminInquiry = {
  id: string
  user: { id: string; nickname: string; isGuest: boolean }
  category: InquiryInput['category']
  answers: Record<string, string>
  body: string
  status: 'open' | 'answered'
  answer: string | null
  answeredAt: string | null
  createdAt: string
}
export type ArtistInput = { id?: string; name: string; nameJa: string | null; nameEn: string | null; aliases: string[] }

export type PublicProfile = Profile & {
  artistIds: string[]
  genreIds: number[]
  favoriteIds: string[]
  relation: 'none' | 'friend' | 'sent' | 'received' | 'self'
  roomId: string | null
}

export type Recommended = UserCard & { score: number; commonArtists: number }

export type FriendRequest = { id: string; user: UserCard; direction: 'in' | 'out'; createdAt: string; expiresAt: string }

export type Friend = UserCard & { roomId: string }

export type Room = {
  id: string
  kind: 'dm' | 'support'
  partner: { id: string | null; nickname: string; avatarUrl: string | null }
  lastBody: string | null
  lastKind: 'text' | 'image' | 'system' | null
  lastAt: string
  unread: number
  canSend: boolean
}

export type Message = {
  id: string
  roomId: string
  senderId: string | null // null = 시스템·운영팀
  kind: 'text' | 'image' | 'system'
  body: string
  imageUrl: string | null
  createdAt: string
}

export type Post = {
  id: string
  author: UserCard
  title: string
  body: string
  tags: string[]
  imageUrls: string[]
  likeCount: number
  commentCount: number
  likedByMe: boolean
  createdAt: string
}

export type Comment = { id: string; postId: string; author: UserCard; body: string; createdAt: string }

export type ReportReason = 'abuse' | 'sexual' | 'scam' | 'spam' | 'harmful_image' | 'etc'
export type ReportTarget = { userId?: string; postId?: string; commentId?: string; messageId?: string }

export type InquiryInput = {
  category: 'bug' | 'concert_info' | 'account' | 'report' | 'suggestion' | 'etc'
  answers: Record<string, string>
  body: string
}

export type OAuthProvider = 'google' | 'apple' | 'kakao'
export type ImageKind = 'avatar' | 'banner' | 'posts'

export type RealtimeEvent = { type: 'message'; roomId: string } | { type: 'request' }

export type ProfilePatch = Partial<Pick<Profile, 'nickname' | 'bio' | 'avatarUrl' | 'bannerUrl' | 'profileSetupDone' | 'notifyEnabled'>> & {
  communityAgreed?: boolean
}

export interface Api {
  mode: 'supabase' | 'demo'

  // 계정
  sessionUserId(): Promise<string | null>
  onAuthChange(cb: (userId: string | null) => void): () => void
  signInGuest(): Promise<void>
  signInOAuth(provider: OAuthProvider): Promise<void>
  signUpEmail(email: string, password: string): Promise<{ needsConfirm: boolean }>
  signInEmail(email: string, password: string): Promise<void>
  resetPassword(email: string): Promise<void>
  signOut(): Promise<void>
  deleteAccount(): Promise<void>

  // 내 정보
  getMe(): Promise<Me>
  updateMe(patch: ProfilePatch): Promise<void>
  setMyArtists(ids: string[]): Promise<void>
  setMyGenres(ids: number[]): Promise<void>
  saveConsents(values: Record<string, boolean>): Promise<void>
  uploadImage(kind: ImageKind, file: Blob): Promise<string>

  // 공연·아티스트
  listGenres(): Promise<Genre[]>
  listArtists(): Promise<Artist[]>
  listConcerts(): Promise<Concert[]>
  openDataUpdatedAt(): Promise<string | null> // KOPIS 공연 정보를 마지막으로 받은 시각 (출처 표시의 최종집계일)
  setFavorite(concertId: string, on: boolean): Promise<void>

  // 사람·친구
  getProfile(userId: string): Promise<PublicProfile>
  recommend(): Promise<Recommended[]>
  searchUsers(q: string, filter: { genreId?: number; artistId?: string }): Promise<UserCard[]>
  sendFriendRequest(userId: string): Promise<void>
  listRequests(): Promise<FriendRequest[]>
  respondRequest(requestId: string, accept: boolean): Promise<string | null>
  listFriends(): Promise<Friend[]>
  removeFriend(userId: string): Promise<void>
  block(userId: string): Promise<void>
  unblock(userId: string): Promise<void>
  listBlocked(): Promise<UserCard[]>
  report(target: ReportTarget, reason: ReportReason, detail?: string): Promise<void>

  // 채팅
  listRooms(): Promise<Room[]>
  listMessages(roomId: string): Promise<Message[]>
  sendText(roomId: string, body: string): Promise<void>
  sendImage(roomId: string, file: Blob): Promise<void>
  markRead(roomId: string): Promise<void>
  subscribe(cb: (e: RealtimeEvent) => void): () => void

  // 커뮤니티
  listPosts(filter: { q?: string; tag?: string; authorId?: string }): Promise<Post[]>
  getPost(id: string): Promise<Post>
  createPost(input: { title: string; body: string; tags: string[]; images: Blob[] }): Promise<string>
  deletePost(id: string): Promise<void>
  toggleLike(postId: string): Promise<boolean>
  listComments(postId: string): Promise<Comment[]>
  addComment(postId: string, body: string): Promise<void>

  // 문의
  submitInquiry(input: InquiryInput): Promise<void>

  // 운영자 (is_admin() 계정만. 그 밖의 계정은 DB 가 막는다)
  adminReviewConcerts(): Promise<AdminConcert[]>
  adminGetConcert(id: string): Promise<AdminConcert>
  adminPublishConcert(id: string, input: { artistIds: string[]; ticketOpenAt: string | null }): Promise<void>
  adminHideConcert(id: string): Promise<void>
  adminSearchInbox(q: string): Promise<InboxItem[]>
  adminImportConcert(kopisId: string): Promise<string> // 가져온 공연 id (검수 대기)
  adminSearchArtists(q: string): Promise<AdminArtist[]>
  adminGetArtist(id: string): Promise<AdminArtist>
  adminSaveArtist(input: ArtistInput): Promise<string>
  adminReports(): Promise<AdminReport[]> // 처리 대기 전체 + 최근 처리분
  adminResolveReport(id: string, resolution: 'resolved' | 'dismissed', hideContent: boolean): Promise<void>
  adminSanction(userId: string, level: SanctionLevel, reason: string, days?: number): Promise<void>
  adminInquiries(): Promise<AdminInquiry[]> // 답변 대기 전체 + 최근 답변분
  adminAnswerInquiry(id: string, answer: string): Promise<{ mailed: boolean }>
}

// 서버 오류 코드 → 사용자 문구
export const errorText = (e: unknown) => {
  const m = e instanceof Error ? e.message : String(e)
  const map: Record<string, string> = {
    duplicate: '이미 요청을 보냈어요. 응답을 기다려 주세요.',
    already_friends: '이미 친구예요.',
    daily_limit: '오늘 보낼 수 있는 친구 요청을 모두 보냈어요.',
    unavailable: '지금은 이 사용자에게 요청할 수 없어요.',
    limit_reached: '선택할 수 있는 개수를 넘었어요.',
    account_restricted: '이용이 제한된 계정이에요. 문의하기로 연락해 주세요.',
    not_found: '이미 처리됐거나 사라진 항목이에요.',
    forbidden: '운영자만 할 수 있어요.',
    kopis_unavailable: 'KOPIS에서 공연 정보를 받지 못했어요. 잠시 후 다시 시도해 주세요.',
    demo_admin: '운영자 기능은 Supabase에 연결했을 때만 쓸 수 있어요.',
    'Invalid login credentials': '이메일 또는 비밀번호가 맞지 않아요.',
    'User already registered': '이미 가입된 이메일이에요. 로그인해 주세요.',
  }
  const key = Object.keys(map).find((k) => m.includes(k))
  return key ? map[key] : '문제가 생겼어요. 잠시 후 다시 시도해 주세요.'
}
