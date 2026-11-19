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
  introUrls?: string[] // KOPIS 소개 이미지 (포스터보다 큰 상세 안내 이미지)
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
  region: string | null // 활동 지역(시·도, 선택). 덕친 추천에서 가까운 사람을 앞에 둔다
}

export type Me = Profile & {
  regionPublic: boolean // 끄면 남에게 지역이 안 보이고, 가까운 사람 먼저 추천도 빠진다
  artistIds: string[]
  genreIds: number[]
  favoriteIds: string[]
  consents: Record<string, boolean> // 항목별 최신 동의 값 (현재 약관 버전 기준)
  consentsOk: boolean // 필수 항목 모두 현재 버전으로 동의했는가
  email: string | null // 카카오 계정은 이메일을 받지 않아 null
  loginMethod: LoginMethod
  needsLoginId: boolean // 이메일로 가입했는데 아직 로그인 아이디를 안 만들었다 → 아이디 만들기 화면으로
  notify: NotifyPrefs
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
export type AdminTicketTip = {
  id: string
  concertId: string
  concertTitle: string
  currentOpenAt: string | null // 공연에 지금 들어 있는 예매 오픈일
  openAt: string // 제보한 날짜
  sourceUrl: string
  status: 'pending' | 'approved' | 'rejected'
  user: { id: string; nickname: string } | null
  createdAt: string
  resolvedAt: string | null
}
export type AdminUser = {
  id: string
  nickname: string
  isGuest: boolean
  status: 'active' | 'suspended' | 'banned'
  isAdmin: boolean
  login: string // guest · email · kakao · naver · google · apple (여러 개면 쉼표)
  createdAt: string
  lastSeenAt: string
  sanctions: number
}
export type AdminUserDetail = Omit<AdminUser, 'sanctions'> & { bio: string; posts: number; comments: number; reportsAgainst: number }
export type AdminSanctionRecord = { level: SanctionLevel; reason: string; startsAt: string; endsAt: string | null }
export type AdminTicketClick = { concertId: string | null; concertTitle: string | null; vendor: string; clicks: number; users: number }
export type AdminUserStats ={ members: number; guests: number; active7d: number; suspended: number; banned: number }
export type AdminArtist = Artist & { aliases: string[]; source: 'admin' | 'musicbrainz' }
export type SanctionLevel = 'warning' | 'suspend' | 'ban'
export type WordCategory = 'abuse' | 'sexual' | 'hate' | 'scam'
export type BannedWord = { word: string; match: 'contains' | 'exact'; category: WordCategory }
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
  favoriteIds: string[] // 다가오는 관심 공연은 본인·친구에게만 들어온다 (서버 profile_card)
  upcomingCount: number // 다가오는 관심 공연 수 (목록이 가려져도 개수는 보인다)
  relation: 'none' | 'friend' | 'sent' | 'received' | 'self'
  roomId: string | null
}

export type Recommended = UserCard & { score: number; commonArtists: number; region: string | null }

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
  gifSlug: string | null // KLIPY GIF 면 콘텐츠 id (신고할 때 KLIPY 에 넘긴다)
  createdAt: string
  deleted?: boolean // 보낸 사람이 지움 → body 는 '삭제된 메시지예요'
  edited?: boolean // 보낸 사람이 고침
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
  concertId: string | null // 공연 후기면 그 공연
  edited: boolean // 작성자가 고친 적 있음
}

// parentId: 대댓글이면 원 댓글, replyTo: 누구에게 단 답글인지
export type Comment = { id: string; postId: string; author: UserCard; body: string; createdAt: string; edited: boolean; parentId: string | null; replyTo: { id: string; nickname: string } | null }
// 알림 종류별 켜고 끄기 (서비스 알림이 켜져 있을 때만 의미)
export type NotifyPrefs = { friend: boolean; like: boolean; comment: boolean; concert: boolean }

export type ReportReason = 'abuse' | 'sexual' | 'scam' | 'spam' | 'harmful_image' | 'etc'
export type ReportTarget = { userId?: string; postId?: string; commentId?: string; messageId?: string }

// 멤버십: 무료 / 월 구독(아티스트·장르 20, 개월 수 뱃지)
export type MembershipTier = 'free' | 'subscriber'
export type Membership = {
  tier: MembershipTier
  subStartedAt: string | null
  subUntil: string | null // 지난 날짜면 끝난 구독
  maxArtists: number
  maxGenres: number
  months: number | null // 구독 중일 때 결제일부터 꽉 채운 달 수, 첫 달 0 (뱃지). 구독 중이 아니면 null
  autoRenew: boolean // false = 해지 예약 (subUntil 까지만 이용)
  platform: 'pg' | 'apple' | 'google' | null // 결제 수단 (null = 결제 없음·운영자 지급)
  methodLabel: string | null // '카카오페이', '신한카드 ****1234'
  nextChargeAt: string | null // 다음 결제일 (결제 실패 중이면 다음 재시도). 해지 예약이면 null
  nextAmountKrw: number | null
  pastDue: boolean // 결제 실패: 유예 기간 동안 혜택 유지하며 재시도 중
}
// 멤버십 가격 안내 (서버가 정한 값. 결제 금액도 서버가 다시 정한다)
export type MembershipOffer = { priceKrw: number; firstPriceKrw: number | null; available: boolean }
// 결제 준비 (1회용 번호 15분)
export type Checkout = { issueId: string; customerId: string; orderName: string; amountKrw: number; promo: boolean }
export type AdminMembershipAction = 'subscribe' | 'end_sub' | 'clear'
// 운영자 화면: 멤버십 + 마지막 PG 결제 구독 (환불할 수 있는 금액은 이번 기간 결제에서 이미 환불한 만큼 뺀 값)
export type AdminMembership = Pick<Membership, 'subStartedAt' | 'subUntil' | 'months' | 'methodLabel'> & {
  subscriptionId: number | null
  subState: 'active' | 'past_due' | 'ended' | 'revoked' | null
  refundableKrw: number | null
  paidAt: string | null
  within7days: boolean
}

// 다녀온 공연 기록 (덕질 캘린더·리캡의 바탕). 기록은 회원 누구나, 후기 사진 한 장은 멤버십 회원만
export type Attendance = {
  concertId: string
  day: string // 다녀온 날 YYYY-MM-DD (KST)
  photoUrl: string | null // 후기 사진 (멤버십 전용)
  postId: string | null // 이 공연으로 쓴 내 후기 글
  createdAt: string
}
// 덕질 캘린더 사진: 하루 여러 장(최대 DAILY_PHOTO_MAX) (멤버십 전용, 본인만 봄)
export type DailyPhoto = { id: string; day: string; photoUrl: string }
export const DAILY_PHOTO_MAX = 10 // DB daily_photos 정책과 같게
// 리캡 재료. 남의 리캡은 그 사람이 공개로 둔 구독자일 때만 visible
export type RecapSource = { visible: boolean; records: Pick<Attendance, 'concertId' | 'day'>[] }

export type MyInquiry = {
  id: string
  category: InquiryInput['category']
  body: string
  status: 'open' | 'answered'
  answer: string | null
  answeredAt: string | null
  createdAt: string
}

export type InquiryInput = {
  category: 'bug' | 'concert_info' | 'account' | 'report' | 'suggestion' | 'etc'
  answers: Record<string, string>
  body: string
}

// 서버 함수 login-id 와 같은 규칙
export const LOGIN_ID = /^[a-z][a-z0-9_]{3,19}$/

export type OAuthProvider = 'google' | 'apple' | 'kakao' | 'naver'
export type LoginMethod = 'guest' | 'email' | OAuthProvider
export type ImageKind = 'avatar' | 'banner' | 'posts'

export type RealtimeEvent = { type: 'message'; roomId: string } | { type: 'request' } | { type: 'notice' }

// startsAt: 공개 시각(예약 공지는 그 전까지 운영자에게만 보인다), endsAt: 상단 팝업을 띄우는 마지막 시각 (null = 제한 없음)
export type Notice = { id: string; title: string; body: string; startsAt: string; endsAt: string | null }

export type ProfilePatch = Partial<Pick<Profile, 'nickname' | 'bio' | 'avatarUrl' | 'bannerUrl' | 'profileSetupDone' | 'notifyEnabled' | 'region'>> & {
  notify?: Partial<NotifyPrefs>
  communityAgreed?: boolean
  regionPublic?: boolean
}

export interface Api {
  mode: 'supabase' | 'demo'

  // 계정
  sessionUserId(): Promise<string | null>
  onAuthChange(cb: (userId: string | null) => void): () => void
  signInGuest(captchaToken?: string): Promise<void> // captchaToken: Supabase Auth 캡차를 켰을 때 (components/Captcha)
  signInOAuth(provider: OAuthProvider): Promise<void>
  checkLoginId(loginId: string): Promise<boolean> // 쓸 수 있으면 true
  sendEmailCode(email: string): Promise<{ expiresIn: number }>
  verifyEmailCode(email: string, code: string): Promise<string> // 인증 완료 표
  signUpEmail(ticket: string, loginId: string, password: string): Promise<void>
  signInEmail(email: string, password: string, captchaToken?: string): Promise<void>
  signInLoginId(loginId: string, password: string): Promise<void>
  completeSocialLogin(tokenHash: string): Promise<void> // 네이버·카카오: 서버 함수가 준 일회용 토큰으로 세션 받기
  setLoginId(loginId: string): Promise<void>
  myLoginId(): Promise<string | null>
  // 아이디 찾기: 캡차 + 이메일 → 인증 코드 메일 → 코드가 맞으면 아이디를 화면에만 (ticket: 바로 비밀번호를 바꿀 때 코드 대신)
  findLoginIdCode(email: string, captchaToken?: string): Promise<{ mailReady: boolean }>
  findLoginIdVerify(email: string, code: string): Promise<{ loginId: string; ticket: string }>
  // 비밀번호 찾기: 캡차 + 아이디 + 가입 이메일이 맞으면 그 이메일로 인증 코드 → 코드(또는 아이디 찾기의 ticket) + 새 비밀번호
  requestPasswordReset(loginId: string, email: string, captchaToken?: string): Promise<void>
  resetPasswordWithCode(loginId: string, email: string, proof: { code: string } | { ticket: string }, password: string): Promise<void>
  updatePassword(password: string): Promise<void>
  signOut(): Promise<void>
  deleteAccount(): Promise<void>

  // 내 정보
  getMe(): Promise<Me>
  updateMe(patch: ProfilePatch): Promise<void>
  setMyArtists(ids: string[]): Promise<void>
  setMyGenres(ids: number[]): Promise<void>
  myMembership(): Promise<Membership>
  setMyAutoRenew(on: boolean): Promise<void> // 구독 해지 예약(false)·해지 취소(true)
  membershipOffer(): Promise<MembershipOffer>
  pgCheckout(): Promise<Checkout> // 웹 PG 결제 준비 (already_subscribed·not_ready)
  pgStart(issueId: string, billingKey: string): Promise<{ pending: boolean }> // 빌링키로 첫 달 결제. 서버가 포트원에 확인한 뒤 반영 (payment_failed)
  myAttendance(): Promise<Attendance[]> // 내가 다녀온 공연 (최근 순)
  // 다녀온 공연 기록 넣기·고치기. photo: 후기 사진 한 장 (멤버십 회원만, 아니면 membership_only). photo 를 빼면 있던 사진은 그대로, null 이면 지운다
  setAttendance(input: { concertId: string; day: string; photo?: Blob | null }): Promise<void>
  removeAttendance(concertId: string, day: string): Promise<void>
  myDailyPhotos(): Promise<DailyPhoto[]>
  addDailyPhotos(day: string, photos: Blob[]): Promise<void> // 멤버십 회원만 (membership_only), 하루 DAILY_PHOTO_MAX 장까지 (too_many_photos)
  removeDailyPhoto(id: string): Promise<void>
  userRecaps(userId: string): Promise<RecapSource> // 본인은 늘 보이고, 남은 리캡 공개한 구독자만
  myRecapPublic(): Promise<boolean>
  setRecapPublic(on: boolean): Promise<void>
  memberBadge(userId: string): Promise<number | null> // 구독 개월 수 (구독 중이 아니면 null)
  saveConsents(values: Record<string, boolean>): Promise<void>
  uploadImage(kind: ImageKind, file: Blob): Promise<string>

  // 공연·아티스트
  listGenres(): Promise<Genre[]>
  listArtists(): Promise<Artist[]>
  listConcerts(): Promise<Concert[]>
  openDataUpdatedAt(): Promise<string | null> // KOPIS 공연 정보를 마지막으로 받은 시각 (출처 표시의 최종집계일)
  setFavorite(concertId: string, on: boolean): Promise<void>
  submitTicketTip(concertId: string, openAt: string, sourceUrl: string): Promise<void> // 예매 오픈일 제보 (회원만)
  logTicketClick(concertId: string, url: string): Promise<void> // 예매 링크 클릭 기록 (운영자 통계용, 실패해도 무시)

  // 사람·친구
  getProfile(userId: string): Promise<PublicProfile>
  recommend(): Promise<Recommended[]>
  searchUsers(q: string, filter: { genreId?: number; artistId?: string }): Promise<UserCard[]>
  sendFriendRequest(userId: string): Promise<void>
  cancelFriendRequest(userId: string): Promise<void> // 내가 보낸 대기 중 요청 취소 (없으면 not_found)
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
  sendImage(roomId: string, file: Blob): Promise<void> // 기기의 사진·GIF·영상 (영상은 imageUrl 확장자로 구분, isVideo)
  sendGif(roomId: string, url: string, slug: string): Promise<void> // KLIPY 미디어 주소를 그대로 보낸다 (다시 올리지 않는다)
  editMessage(id: string, body: string): Promise<void> // 내 글 메시지만 (서버 edit_my_message)
  markRead(roomId: string): Promise<void>
  deleteMessage(id: string): Promise<void> // 내가 보낸 것만 (서버 delete_my_message)
  subscribe(cb: (e: RealtimeEvent) => void): () => void

  // 커뮤니티
  listPosts(filter: { q?: string; tag?: string; authorId?: string; concertId?: string; reviews?: boolean }): Promise<Post[]> // reviews: 공연 후기(공연 연결 또는 '후기' 태그)
  getPost(id: string): Promise<Post>
  createPost(input: { title: string; body: string; tags: string[]; images: Blob[]; concertId?: string | null }): Promise<string>
  deletePost(id: string): Promise<void>
  toggleLike(postId: string): Promise<boolean>
  listComments(postId: string): Promise<Comment[]>
  addComment(postId: string, body: string, reply?: { parentId: string; toUserId: string }): Promise<void>
  // 수정은 본인 글·댓글만 (서버 edit_post·edit_comment 가 작성자를 확인한다). 사진·공연 연결은 못 바꾼다
  editPost(id: string, input: { title: string; body: string; tags: string[] }): Promise<void>
  editComment(id: string, body: string): Promise<void>

  adminIds(): Promise<string[]> // 관리자 id (커뮤니티 '관리자' 표시용)

  // 공지 (최신순)
  listNotices(): Promise<Notice[]>
  getNotice(id: string): Promise<Notice>

  // 문의
  submitInquiry(input: InquiryInput): Promise<void>
  myInquiries(): Promise<MyInquiry[]> // 최신순. 답변 완료는 1년 뒤 정리된다

  // 운영자 (is_admin() 계정만. 그 밖의 계정은 DB 가 막는다)
  adminReviewConcerts(): Promise<AdminConcert[]>
  adminGetConcert(id: string): Promise<AdminConcert>
  adminPublishConcert(id: string, input: { artistIds: string[]; ticketOpenAt: string | null }): Promise<void>
  adminHideConcert(id: string): Promise<void>
  adminSearchInbox(q: string): Promise<InboxItem[]>
  adminImportConcert(kopisId: string): Promise<string> // 가져온 공연 id (검수 대기)
  adminSearchArtists(q: string, page?: number): Promise<AdminArtist[]> // 40명씩 (page 0부터)
  adminGetArtist(id: string): Promise<AdminArtist>
  adminSaveArtist(input: ArtistInput): Promise<string>
  adminReports(): Promise<AdminReport[]> // 처리 대기 전체 + 최근 처리분
  adminResolveReport(id: string, resolution: 'resolved' | 'dismissed', hideContent: boolean): Promise<void>
  adminSanction(userId: string, level: SanctionLevel, reason: string, days?: number): Promise<void>
  adminMembership(userId: string): Promise<AdminMembership | null>
  adminSetMembership(userId: string, action: AdminMembershipAction, months?: number): Promise<void> // 시험 지급 (결제 구독이 있으면 has_paid_subscription)
  adminRefund(subscriptionId: number, reason: string, amountKrw?: number): Promise<{ refundedKrw: number }> // 이번 기간 결제 (일부) 취소 + 구독 바로 끝 (pg-refund)
  adminInquiries(): Promise<AdminInquiry[]> // 답변 대기 전체 + 최근 답변분
  adminAnswerInquiry(id: string, answer: string): Promise<{ mailed: boolean }>
  adminDeleteInquiry(id: string): Promise<void> // 답변 완료 문의만 (대기 중이면 not_answered)
  adminWords(): Promise<{ banned: BannedWord[]; allowed: string[] }>
  adminAddWord(input: { allowed: true; word: string } | ({ allowed?: false } & BannedWord)): Promise<void>
  adminDeleteWord(allowed: boolean, word: string): Promise<void>
  adminTicketTips(): Promise<AdminTicketTip[]> // 확인 대기 전체 + 최근 처리분
  adminResolveTicketTip(id: string, approve: boolean): Promise<void>
  adminTicketClicks(days: number): Promise<AdminTicketClick[]> // 최근 N일 공연·예매처별 클릭 수 (많은 순)
  adminUsers(q: string, page: number, guests?: boolean): Promise<{ users: AdminUser[]; total: number }> // 50명씩. guests: 비회원 칸
  adminUserStats(): Promise<AdminUserStats>
  adminUser(id: string): Promise<{ user: AdminUserDetail | null; sanctions: AdminSanctionRecord[] }>
  adminDeletePost(postId: string, reason: string): Promise<void> // 사유와 함께 지우고 작성자에게 알림
  adminPostNotice(title: string, body: string, endsAt: string | null, startsAt: string | null): Promise<string> // startsAt: 업로드 예약 (null = 바로)
  adminDeleteNotice(id: string): Promise<void>
  adminTestText(text: string): Promise<{ word: string | null; masked: string }> // 걸린 단어, 채팅에서 가려지는 모습
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
    not_subscribed: '구독 중일 때만 바꿀 수 있어요.',
    too_many_requests: '잠시 후 다시 시도해 주세요.',
    already_subscribed: '이미 멤버십을 이용 중이에요.',
    checkout_expired: '결제 시간이 지났어요. 처음부터 다시 시도해 주세요.',
    payment_failed: '결제하지 못했어요. 결제 수단을 확인하고 다시 시도해 주세요.',
    payment_canceled: '결제를 취소했어요.',
    payment_retry: '결제가 실패한 상태예요. 결제 수단을 바꿔 다시 결제해 주세요.',
    use_store: '앱스토어·구글 플레이에서 구독을 관리해 주세요.',
    has_paid_subscription: '결제로 이용 중인 구독은 바꿀 수 없어요.',
    refund_failed: '환불하지 못했어요. 포트원 콘솔에서 결제 상태를 확인해 주세요.',
    bad_amount: '환불할 수 있는 금액을 넘었어요.',
    membership_only: '사진 기록은 멤버십 회원만 할 수 있어요.',
    too_many_photos: '하루에 사진은 10장까지 담을 수 있어요.',
    not_ready: '아직 준비 중인 기능이에요.',
    account_restricted: '이용이 제한된 계정이에요. 문의하기로 연락해 주세요.',
    not_found: '이미 처리됐거나 사라진 항목이에요.',
    not_answered: '답변을 마친 문의만 삭제할 수 있어요.',
    forbidden: '관리자만 할 수 있어요.',
    kopis_unavailable: 'KOPIS에서 공연 정보를 받지 못했어요. 잠시 후 다시 시도해 주세요.',
    word_exists: '이미 목록에 있는 단어예요.',
    blocked_word:'사용할 수 없는 표현이 들어 있어요. 고쳐서 다시 올려 주세요.',
    notice_bad_period: '노출 기간은 공개 시각 이후로 정해 주세요.',
    notice_bad_schedule: '예약은 1년 안으로 정해 주세요.',
    members_only:'회원만 할 수 있어요. 회원 로그인 후 이용해 주세요.',
    tip_exists: '이 공연에 보낸 제보를 관리자가 확인하고 있어요.',
    bad_body: '메시지 내용을 입력해 주세요.',
    tip_bad_date: '날짜를 다시 확인해 주세요. (최근 30일 ~ 1년 뒤)',
    tip_bad_url: 'https:// 로 시작하는 공지 링크를 넣어 주세요.',
    email_code_invalid: '인증 코드가 맞지 않아요.',
    password_rule: '비밀번호는 영문과 숫자를 섞어 8~72자로 정해 주세요.',
    email_code_expired: '인증 코드가 만료됐어요. 인증 메일을 다시 받아 주세요.',
    email_ticket_expired: '메일 인증 시간이 지났어요. 다시 인증해 주세요.',
    captcha_failed: '로봇이 아닌지 확인하지 못했어요. 확인을 다시 해 주세요.',
    mail_not_ready: '인증 메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요.',
    invalid_login: '아이디 또는 비밀번호가 올바르지 않습니다.',
    too_many_attempts: '시도가 너무 많아요. 10분 뒤에 다시 해 주세요.',
    login_id_taken: '이미 쓰고 있는 아이디예요.',
    login_id_exists: '이미 아이디를 만들었어요.',
    login_id_format: '아이디는 영문 소문자로 시작하고, 영문 소문자·숫자·밑줄로 4~20자여야 해요.',
    email_taken: '이미 다른 방법으로 가입한 이메일이에요. 처음 가입한 방법으로 로그인해 주세요.',
    naver_email: '네이버 로그인에는 이메일 제공 동의가 필요해요.',
    state_expired: '로그인 요청이 만료됐어요. 다시 시도해 주세요.',
    social_cancelled: '로그인을 취소했어요.',
    social_failed: '로그인하지 못했어요. 잠시 후 다시 시도해 주세요.',
    demo_admin:'관리자 기능은 Supabase에 연결했을 때만 쓸 수 있어요.',
    'Invalid login credentials': '이메일 또는 비밀번호가 맞지 않아요.',
    'User already registered': '이미 가입된 이메일이에요. 로그인해 주세요.',
  }
  const key = Object.keys(map).find((k) => m.includes(k))
  if (key) return map[key]
  // 닉네임 중복·허용 문자 오류는 API 가 이미 사용자 문구로 만들어 던진다 (supabaseApi·demoApi updateMe)
  return m.includes('닉네임') ? m : '문제가 생겼어요. 잠시 후 다시 시도해 주세요.'
}
