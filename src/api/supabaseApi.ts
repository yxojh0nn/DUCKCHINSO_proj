import type { SupabaseClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { authRedirect, socialLoginUrl } from '@/lib/supabase'
import { isKlipyUrl } from '@/lib/klipy'
import { cachedPhotoUrl, clearPhotoCache, dropCachedPhoto } from '@/lib/photoCache'
import { CONSENT_ITEMS, CONSENT_VERSION, REQUIRED_KEYS } from '@/data/consent'
import { DAILY_PHOTO_MAX, NICK_TAKEN } from './types'
import type { AdminArtist, AdminConcert, Api, LoginMethod, BannedWord, Concert, Message, Notice, Post, UserCard } from './types'

type Row = Record<string, any>

const card = (p: Row | null): UserCard => ({
  id: p?.id ?? '', nickname: p?.nickname ?? '알 수 없음', bio: p?.bio ?? '', avatarUrl: p?.avatar_url ?? null,
})

// 서버 함수 호출. 실패하면 함수가 돌려준 오류 코드(예: invalid_login)를 메시지로 던진다 → errorText 가 문구로 바꾼다
async function fnCall<T>(sb: SupabaseClient, name: string, body: object): Promise<T> {
  const { data, error } = await sb.functions.invoke(name, { body })
  if (error) {
    const b = await (error as { context?: Response }).context?.json?.().catch(() => null)
    throw new Error(b?.error ?? error.message)
  }
  return data as T
}

const ext = (b: Blob) => (b.type.split('/')[1] ?? 'jpg').replace('jpeg', 'jpg').replace('quicktime', 'mov')

const ADMIN_CONCERT = 'id, kopis_id, title, poster_url, venue_name, region, status, review_score, review_reasons, visit, cast_text, promoter, ticket_open_at, concert_schedules(starts_at), concert_artists(artist_id)'
const adminConcert = (r: Row): AdminConcert => ({
  id: r.id, kopisId: r.kopis_id, title: r.title, posterUrl: r.poster_url, venue: r.venue_name, region: r.region,
  schedules: (r.concert_schedules ?? []).map((s: Row) => new Date(s.starts_at).toISOString()).sort(),
  status: r.status, score: r.review_score, reasons: r.review_reasons ?? [], visit: r.visit, cast: r.cast_text, promoter: r.promoter,
  artistIds: (r.concert_artists ?? []).map((a: Row) => a.artist_id), ticketOpenAt: r.ticket_open_at,
})

const notice = (r: Row): Notice => ({ id: r.id, title: r.title, body: r.body, startsAt: r.starts_at, endsAt: r.ends_at })

const adminArtist = (r: Row): AdminArtist => ({ id: r.id, name: r.name, nameJa: r.name_ja, nameEn: r.name_en, aliases: r.aliases ?? [], source: r.source })

export function createSupabaseApi(sb: SupabaseClient): Api {
  const fn = <T = unknown>(name: string, body: object) => fnCall<T>(sb, name, body)
  const uid = async () => {
    const { data } = await sb.auth.getSession()
    const id = data.session?.user.id
    if (!id) throw new Error('not_authenticated')
    return id
  }
  const ok = <T>(r: { data: T; error: { message: string } | null }) => {
    if (r.error) throw new Error(r.error.message)
    return r.data
  }

  const signedChatUrls = async (rows: Row[]) => {
    const paths = rows.map((m) => m.image_path).filter((p) => p && !isKlipyUrl(p))
    if (!paths.length) return new Map<string, string>()
    const { data } = await sb.storage.from('chat-media').createSignedUrls(paths, 3600)
    return new Map((data ?? []).map((d) => [d.path ?? '', d.signedUrl]))
  }

  const toPost = (p: Row, liked: Set<string>): Post => ({
    id: p.id, author: card(p.author), title: p.title, body: p.body, tags: p.tags ?? [], imageUrls: p.image_urls ?? [],
    likeCount: p.like_count, commentCount: p.comment_count, likedByMe: liked.has(p.id), createdAt: p.created_at, concertId: p.concert_id ?? null, edited: !!p.edited_at,
  })

  const api: Api = {
    mode: 'supabase',

    async sessionUserId() {
      const { data } = await sb.auth.getSession()
      return data.session?.user.id ?? null
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_e, s) => cb(s?.user.id ?? null))
      return () => data.subscription.unsubscribe()
    },
    async signInGuest(captchaToken) {
      const { error } = await sb.auth.signInAnonymously({ options: { captchaToken } })
      if (error) throw error
    },
    async signInOAuth(provider) {
      const native = Capacitor.isNativePlatform()
      // 네이버·카카오: Supabase 기본 제공자가 아니라 서버 함수 social-login 이 직접 처리한다 (돌아오면 exchangeSocialCode)
      if (provider === 'naver' || provider === 'kakao') {
        const url = await socialLoginUrl(provider)
        if (native) await Browser.open({ url })
        else window.location.assign(url)
        return
      }
      const { data, error } = await sb.auth.signInWithOAuth({
        provider, options: { redirectTo: authRedirect(), skipBrowserRedirect: native },
      })
      if (error) throw error
      // 앱: 구글은 웹뷰 로그인을 막으므로 시스템 브라우저로 열고 딥링크로 돌아온다 (기획서 3.4)
      if (native && data.url) await Browser.open({ url: data.url })
    },
    async checkLoginId(loginId) {
      return (await fn<{ available: boolean }>('login-id', { action: 'check_id', loginId })).available
    },
    async sendEmailCode(email) {
      return fn<{ expiresIn: number }>('login-id', { action: 'email_code', email })
    },
    async verifyEmailCode(email, code) {
      return (await fn<{ ticket: string }>('login-id', { action: 'email_verify', email, code })).ticket
    },
    async signUpEmail(ticket, loginId, password) {
      const { tokenHash } = await fn<{ tokenHash: string }>('login-id', { action: 'signup', ticket, loginId, password })
      await api.completeSocialLogin(tokenHash)
    },
    async signInEmail(email, password, captchaToken) {
      const { error } = await sb.auth.signInWithPassword({ email, password, options: { captchaToken } })
      if (error) throw error
    },
    async signInLoginId(loginId, password) {
      const { tokenHash } = await fn<{ tokenHash: string }>('login-id', { action: 'login', loginId, password })
      await api.completeSocialLogin(tokenHash)
    },
    async exchangeSocialCode(code, verifier) {
      const { tokenHash } = await fn<{ tokenHash: string }>('social-login', { action: 'exchange', code, verifier })
      await api.completeSocialLogin(tokenHash)
    },
    async completeSocialLogin(tokenHash) {
      const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type: 'email' })
      if (error) throw error
    },
    async setLoginId(loginId) {
      await fn('login-id', { action: 'set', loginId })
    },
    async myLoginId() {
      return (await fn<{ loginId: string | null }>('login-id', { action: 'me' })).loginId
    },
    // 아이디·비밀번호 찾기는 모두 login-id 함수 (캡차 서버 검증·이메일별 횟수 제한·메일 인증 코드, docs/아이디_비밀번호_찾기_설계.md)
    async findLoginIdCode(email, captchaToken) {
      return fn<{ mailReady: boolean }>('login-id', { action: 'find_code', email, captchaToken })
    },
    async findLoginIdVerify(email, code) {
      return fn<{ loginId: string; ticket: string }>('login-id', { action: 'find_verify', email, code })
    },
    async requestPasswordReset(loginId, email, captchaToken) {
      await fn('login-id', { action: 'reset_code', loginId, email, captchaToken })
    },
    async resetPasswordWithCode(loginId, email, proof, password) {
      await fn('login-id', { action: 'reset_verify', loginId, email, ...proof, password })
    },
    // 현재 비밀번호를 서버(login-id)가 확인한 뒤에만 바꾼다 (세션만 훔친 사람은 못 바꾸게)
    async updatePassword(current, password) {
      await fn('login-id', { action: 'change_password', current, password })
      await sb.auth.signOut({ scope: 'others' }) // 비밀번호를 바꾸면 다른 기기 로그인은 끊는다 (도용 대비)
    },
    async signOut() {
      await sb.auth.signOut()
      await clearPhotoCache()
    },
    async deleteAccount() {
      await fn('delete-account', {}) // 오류 코드(reauth_required 등)를 그대로 받으려고 fn 으로
      await sb.auth.signOut({ scope: 'local' })
      await clearPhotoCache()
    },

    async getMe() {
      const id = await uid()
      const [{ data: s }, p, a, g, f, c, adm, login] = await Promise.all([
        sb.auth.getSession(),
        sb.rpc('my_profile').single(), // profiles 표는 공개 칸만 읽힌다 → 내 칸 전부는 함수로
        sb.from('user_artists').select('artist_id').eq('user_id', id).order('created_at'), // 담은 순서 (멤버십 한도를 넘으면 앞에서부터 유효)
        sb.from('user_genres').select('genre_id').eq('user_id', id).order('created_at').order('genre_id'),
        sb.from('favorites').select('concert_id').eq('user_id', id),
        sb.from('consents').select('item, agreed, version').eq('user_id', id).order('created_at', { ascending: false }),
        sb.rpc('is_admin'),
        sb.rpc('my_login').maybeSingle<{ social: 'naver' | 'kakao' | null; needs_login_id: boolean }>(),
      ])
      if (p.error?.code === 'PGRST116') { await sb.auth.signOut({ scope: 'local' }); throw new Error('not_authenticated') } // 지워진 비회원 계정 등
      const prof = ok(p) as Row
      // 항목별 가장 최근 기록만 본다
      const latest = new Map<string, Row>()
      ;(ok(c) as Row[]).forEach((r) => !latest.has(r.item) && latest.set(r.item, r))
      const consents = Object.fromEntries([...latest].map(([k, r]) => [k, r.agreed]))
      sb.from('profiles').update({ last_seen_at: new Date().toISOString() }).eq('id', id).then(() => {})
      return {
        ...card(prof), bannerUrl: prof.banner_url, isGuest: prof.is_guest, profileSetupDone: prof.profile_setup_done,
        communityAgreedAt: prof.community_agreed_at, notifyEnabled: prof.notify_enabled, region: prof.region ?? null, regionPublic: prof.region_public ?? true,
        artistIds: (ok(a) as Row[]).map((r) => r.artist_id),
        genreIds: (ok(g) as Row[]).map((r) => r.genre_id),
        favoriteIds: (ok(f) as Row[]).map((r) => r.concert_id),
        consents,
        consentsOk: REQUIRED_KEYS.every((k) => latest.get(k)?.agreed && latest.get(k)?.version === CONSENT_VERSION),
        // 네이버·카카오는 social-login 이 만든 계정이라 auth 의 제공자가 email 로 보인다 → my_login 의 social 이 우선
        loginMethod: prof.is_guest ? 'guest' : login.data?.social ?? (s.session?.user.app_metadata.provider as LoginMethod | undefined) ?? 'email',
        // 카카오·(인증 이메일이 없는) 네이버 계정은 메일 없는 자리표시 주소다 → 보여 주지 않는다
        email: login.data?.social === 'kakao' || /\.noemail\./.test(s.session?.user.email ?? '') ? null : s.session?.user.email ?? null,
        needsLoginId: login.data?.needs_login_id === true,
        notify: { friend: prof.notify_friend ?? true, like: prof.notify_like ?? true, comment: prof.notify_comment ?? true, concert: prof.notify_concert ?? true },
        isAdmin: adm.data === true,
      }
    },
    async updateMe(patch) {
      const id = await uid()
      const row: Row = {}
      if (patch.nickname !== undefined) row.nickname = patch.nickname
      if (patch.bio !== undefined) row.bio = patch.bio
      if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl
      if (patch.bannerUrl !== undefined) row.banner_url = patch.bannerUrl
      if (patch.profileSetupDone !== undefined) row.profile_setup_done = patch.profileSetupDone
      if (patch.notifyEnabled !== undefined) row.notify_enabled = patch.notifyEnabled
      if (patch.region !== undefined) row.region = patch.region
      if (patch.regionPublic !== undefined) row.region_public = patch.regionPublic
      for (const [k, v] of Object.entries(patch.notify ?? {})) row[`notify_${k}`] = v
      // 동의 시각은 서버가 동의 기록과 함께 찍는다 (직접 수정 권한 없음)
      if (patch.communityAgreed) ok(await sb.rpc('agree_community', { ver: CONSENT_VERSION }))
      if (!Object.keys(row).length) return
      const { error } = await sb.from('profiles').update(row).eq('id', id)
      if (error) throw new Error(error.code === '23505' ? NICK_TAKEN
        : error.message.includes('profiles_nickname_chars') ? '닉네임에는 한글·일본어·영문·숫자와 공백 _ . - 만 쓸 수 있어요.'
        : error.message.includes('profiles_nickname_shape') ? '닉네임에 공백을 두 칸 넘게 쓰거나 기호만 쓸 수 없어요.' : error.message)
    },
    async nicknameAvailable(name) {
      return ok(await sb.rpc('nickname_available', { n: name })) as boolean
    },
    // 바뀐 것만 지우고 넣는다 (이미 담은 것은 담은 시각이 그대로 → 순서 유지)
    async setMyArtists(ids) {
      ok(await sb.rpc('set_my_artists', { ids }))
    },
    async setMyGenres(ids) {
      ok(await sb.rpc('set_my_genres', { ids }))
    },
    async myMembership() {
      const r = ok(await sb.rpc('my_membership').single()) as Row
      return { tier: r.tier, subStartedAt: r.sub_started_at, subUntil: r.sub_until,
        maxArtists: r.max_artists, maxGenres: r.max_genres, months: r.months, autoRenew: r.auto_renew,
        platform: r.platform, methodLabel: r.method_label, nextChargeAt: r.next_charge_at, nextAmountKrw: r.next_amount_krw, pastDue: r.past_due }
    },
    async membershipOffer() {
      const r = ok(await sb.rpc('membership_offer').single()) as Row
      return { priceKrw: r.price_krw, firstPriceKrw: r.first_price_krw, available: r.available }
    },
    // 결제는 서버 함수만 한다 (금액·확인 모두 서버). 앱은 1회용 번호와 결제창이 준 빌링키만 넘긴다
    async pgCheckout() { return fnCall(sb, 'pg-checkout', {}) },
    async pgStart(issueId, billingKey) {
      const r = await fnCall<{ ok?: boolean; pending?: boolean }>(sb, 'pg-start', { issueId, billingKey })
      return { pending: !!r.pending }
    },
    // shortcut: 다녀온 공연 기록은 데모 백엔드에만 있다. DB(concert_attendance 테이블·함수)를 붙이면 여기를 채운다
    async myAttendance() { return [] },
    async setAttendance() { throw new Error('not_ready') },
    async removeAttendance() { throw new Error('not_ready') },
    // 덕질 사진: 비공개 버킷이라 내려받아 기기 캐시에 둔다 (photoCache)
    // shortcut: 목록을 열면 모든 날 사진을 한꺼번에 받는다(처음 한 번만 느림), 사진이 수백 장을 넘으면 달마다 나눠 받는다
    async myDailyPhotos() {
      const rows = ok(await sb.from('daily_photos').select('id, day, path').order('day').order('created_at')) as Row[]
      const dl = (path: string) => async () => ok(await sb.storage.from('diary-media').download(path)) as Blob
      return Promise.all(rows.map(async (r) => ({ id: r.id, day: r.day, photoUrl: await cachedPhotoUrl(r.path, dl(r.path)) })))
    },
    async addDailyPhotos(day, photos) {
      const id = await uid()
      const { count } = await sb.from('daily_photos').select('id', { count: 'exact', head: true }).eq('day', day)
      if ((count ?? 0) + photos.length > DAILY_PHOTO_MAX) throw new Error('too_many_photos')
      for (const b of photos) {
        const path = `${id}/${crypto.randomUUID()}.${ext(b)}`
        const up = await sb.storage.from('diary-media').upload(path, b, { contentType: b.type })
        if (up.error) throw new Error(/row-level security/i.test(up.error.message) ? 'membership_only' : up.error.message)
        const ins = await sb.from('daily_photos').insert({ day, path })
        if (ins.error) { await sb.storage.from('diary-media').remove([path]); throw new Error(ins.error.code === '42501' ? 'membership_only' : ins.error.message) }
      }
    },
    async removeDailyPhoto(pid) {
      const row = ok(await sb.from('daily_photos').delete().eq('id', pid).select('path').single()) as Row
      await sb.storage.from('diary-media').remove([row.path])
      await dropCachedPhoto(row.path)
    },
    async userRecaps() { return { visible: false, records: [] } },
    async myRecapPublic() { return true },
    async setRecapPublic() { throw new Error('not_ready') },
    async setMyAutoRenew(on) {
      ok(await sb.rpc('set_my_auto_renew', { turn_on: on }))
    },
    async memberBadge(userId) {
      return (ok(await sb.rpc('member_badge', { target: userId })) as number | null) ?? null
    },
    async saveConsents(values) {
      const id = await uid()
      const known = new Set(CONSENT_ITEMS.map((c) => c.key))
      const rows = Object.entries(values).filter(([k]) => known.has(k))
        .map(([item, agreed]) => ({ user_id: id, item, agreed, version: CONSENT_VERSION }))
      ok(await sb.from('consents').insert(rows))
    },
    async uploadImage(kind, file) {
      const id = await uid()
      const path = `${id}/${kind}/${crypto.randomUUID()}.${ext(file)}`
      ok(await sb.storage.from('public-media').upload(path, file, { contentType: file.type }))
      return sb.storage.from('public-media').getPublicUrl(path).data.publicUrl
    },

    async listGenres() {
      return ok(await sb.from('genres').select('id, name').eq('is_active', true).order('sort_order')) as any
    },
    async listArtists() {
      const rows = ok(await sb.from('artists').select('id, name, name_ja, name_en').order('name')) as Row[]
      return rows.map((r) => ({ id: r.id, name: r.name, nameJa: r.name_ja, nameEn: r.name_en }))
    },
    async listConcerts() {
      const rows = ok(await sb.from('concerts')
        .select('*, concert_schedules(starts_at), concert_artists(artist_id), ticket_links(vendor, url)')
        .eq('status', 'published')) as Row[]
      return rows.map((r): Concert => ({
        id: r.id, title: r.title, posterUrl: r.poster_url, venue: r.venue_name, venueQuery: r.venue_query,
        region: r.region, priceText: r.price_text, priceMin: r.price_min, priceMax: r.price_max,
        ticketOpenAt: r.ticket_open_at, genreId: r.genre_id, introUrls: r.intro_urls ?? [],
        artistIds: r.concert_artists.map((a: Row) => a.artist_id),
        schedules: r.concert_schedules.map((s: Row) => new Date(s.starts_at).toISOString()).sort(),
        links: r.ticket_links,
      })).filter((c) => c.schedules.length)
    },
    async openDataUpdatedAt() {
      const rows = ok(await sb.from('concerts').select('updated_at').eq('source', 'kopis').order('updated_at', { ascending: false }).limit(1)) as Row[]
      return rows[0]?.updated_at ?? null
    },
    async setFavorite(concertId, on) {
      const id = await uid()
      // ignoreDuplicates = on conflict do nothing. 그냥 upsert 는 do update 라 update 권한이 필요한데 favorites 엔 insert·delete 만 준다
      if (on) ok(await sb.from('favorites').upsert({ user_id: id, concert_id: concertId }, { ignoreDuplicates: true }))
      else ok(await sb.from('favorites').delete().eq('user_id', id).eq('concert_id', concertId))
    },
    async submitTicketTip(concertId, openAt, sourceUrl) {
      ok(await sb.rpc('submit_ticket_tip', { concert: concertId, open_at: openAt, source_url: sourceUrl }))
    },
    async logTicketClick(concertId, url) {
      ok(await sb.rpc('log_ticket_click', { concert: concertId, link_url: url }))
    },

    async getProfile(userId) {
      const me = await uid()
      // 남의 취향·관심 공연 표는 직접 못 읽는다. 한 사람씩 profile_card 로 (다가오는 공연은 친구만)
      const [p, fr, rq] = await Promise.all([
        sb.rpc('profile_card', { target: userId }).single(),
        sb.from('friendships').select('room_id').eq('user_a', me < userId ? me : userId).eq('user_b', me < userId ? userId : me).maybeSingle(),
        sb.rpc('my_requests').select('from_user')
          .or(`and(from_user.eq.${me},to_user.eq.${userId}),and(from_user.eq.${userId},to_user.eq.${me})`),
      ])
      const prof = ok(p) as Row
      const req = (ok(rq) as Row[])[0]
      const friend = ok(fr) as Row | null
      return {
        ...card(prof), bannerUrl: prof.banner_url, isGuest: prof.is_guest, profileSetupDone: prof.profile_setup_done,
        communityAgreedAt: null, notifyEnabled: false, region: prof.region ?? null,
        artistIds: prof.artist_ids ?? [], genreIds: prof.genre_ids ?? [], favoriteIds: prof.favorite_ids ?? [],
        upcomingCount: prof.upcoming_count ?? 0,
        relation: userId === me ? 'self' : friend ? 'friend' : req ? (req.from_user === me ? 'sent' : 'received') : 'none',
        roomId: friend?.room_id ?? null,
      }
    },
    async recommend() {
      const rows = ok(await sb.rpc('recommend_friends', { lim: 30 })) as Row[]
      return rows.map((r) => ({ ...card(r), score: r.score, commonArtists: r.common_artists, region: r.region ?? null }))
    },
    async searchUsers(q, filter) {
      const rows = ok(await sb.rpc('search_users', { q, genre: filter.genreId ?? null, artist: filter.artistId ?? null })) as Row[]
      return rows.map(card)
    },
    async sendFriendRequest(userId) {
      ok(await sb.rpc('send_friend_request', { target: userId }))
    },
    async cancelFriendRequest(userId) {
      ok(await sb.rpc('cancel_friend_request', { target: userId }))
    },
    async listRequests() {
      const me = await uid()
      // my_requests: 만료 전 대기 요청 (보낸 쪽에는 거절된 요청도 대기 중으로 보인다 — 조용한 거절)
      const rows = ok(await sb.rpc('my_requests')
        .select('id, from_user, to_user, created_at, expires_at, from:profiles!friend_requests_from_user_fkey(id, nickname, bio, avatar_url), to:profiles!friend_requests_to_user_fkey(id, nickname, bio, avatar_url)')
        .order('created_at', { ascending: false })) as Row[]
      return rows.map((r) => ({
        id: r.id, direction: r.to_user === me ? 'in' : 'out', user: card(r.to_user === me ? r.from : r.to),
        createdAt: r.created_at, expiresAt: r.expires_at,
      }))
    },
    async respondRequest(requestId, accept) {
      return ok(await sb.rpc('respond_friend_request', { request_id: requestId, accept })) as string | null
    },
    async listFriends() {
      const me = await uid()
      const rows = ok(await sb.from('friendships')
        .select('room_id, a:profiles!friendships_user_a_fkey(id, nickname, bio, avatar_url), b:profiles!friendships_user_b_fkey(id, nickname, bio, avatar_url)')) as Row[]
      return rows.map((r) => ({ ...card(r.a.id === me ? r.b : r.a), roomId: r.room_id }))
    },
    async removeFriend(userId) {
      ok(await sb.rpc('remove_friend', { other: userId }))
    },
    async block(userId) {
      ok(await sb.rpc('block_user', { other: userId }))
    },
    async unblock(userId) {
      ok(await sb.rpc('unblock_user', { other: userId }))
    },
    async listBlocked() {
      const rows = ok(await sb.from('blocks').select('p:profiles!blocks_blocked_fkey(id, nickname, bio, avatar_url)')) as Row[]
      return rows.map((r) => card(r.p))
    },
    async report(target, reason, detail) {
      const me = await uid()
      ok(await sb.from('reports').insert({
        reporter: me, target_user: target.userId ?? null, post_id: target.postId ?? null,
        comment_id: target.commentId ?? null, message_id: target.messageId ?? null, reason, detail: detail ?? null,
      }))
    },

    async listRooms() {
      const rows = ok(await sb.rpc('list_my_rooms')) as Row[]
      return rows.map((r) => ({
        id: r.room_id, kind: r.kind, partner: { id: r.partner_id, nickname: r.partner_nickname, avatarUrl: r.partner_avatar },
        lastBody: r.last_body, lastKind: r.last_kind, lastAt: r.last_at, unread: r.unread, canSend: r.can_send,
      }))
    },
    async listMessages(roomId) {
      const rows = ok(await sb.from('messages').select('*').eq('room_id', roomId)
        .order('created_at', { ascending: false }).limit(200)) as Row[]
      const urls = await signedChatUrls(rows)
      return rows.reverse().map((m): Message => ({
        id: m.id, roomId: m.room_id, senderId: m.sender_id, kind: m.kind, body: m.body,
        imageUrl: !m.image_path ? null : isKlipyUrl(m.image_path) ? m.image_path : urls.get(m.image_path) ?? null, gifSlug: m.gif_slug ?? null, createdAt: m.created_at, deleted: !!m.deleted_at, edited: !!m.edited_at,
      }))
    },
    async editMessage(id, body) {
      ok(await sb.rpc('edit_my_message', { m: id, new_body: body }))
    },
    async deleteMessage(id) {
      const path = ok(await sb.rpc('delete_my_message', { m: id })) as string | null
      if (path && !isKlipyUrl(path)) await sb.storage.from('chat-media').remove([path]) // 사진 파일도 지운다 (실패해도 화면에는 이미 삭제됨)
    },
    async sendText(roomId, body) {
      ok(await sb.from('messages').insert({ room_id: roomId, sender_id: await uid(), kind: 'text', body }))
    },
    async sendImage(roomId, file) {
      const me = await uid()
      const path = `${roomId}/${me}/${crypto.randomUUID()}.${ext(file)}`
      ok(await sb.storage.from('chat-media').upload(path, file, { contentType: file.type }))
      ok(await sb.from('messages').insert({ room_id: roomId, sender_id: me, kind: 'image', image_path: path }))
    },
    async sendGif(roomId, url, slug) {
      ok(await sb.from('messages').insert({ room_id: roomId, sender_id: await uid(), kind: 'image', image_path: url, gif_slug: slug }))
    },
    async markRead(roomId) {
      ok(await sb.rpc('mark_room_read', { r: roomId }))
    },
    subscribe(cb) {
      // RLS가 적용되므로 내가 볼 수 있는 행의 변경만 도착한다. 채널은 구독마다 따로 (공용 이름 'me' 를 쓰지 않는다, 보안 점검 L4)
      const ch = sb.channel(`user:${crypto.randomUUID()}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => cb({ type: 'message', roomId: (p.new as Row).room_id }))
        // 고치기·지우기도 상대 화면에 바로 반영
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (p) => cb({ type: 'message', roomId: (p.new as Row).room_id }))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, () => cb({ type: 'request' }))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, () => cb({ type: 'notice' }))
        .subscribe()
      return () => { sb.removeChannel(ch) }
    },

    async listPosts(filter) {
      const me = await uid()
      let q = sb.from('posts').select('*, author:profiles!posts_author_id_fkey(id, nickname, bio, avatar_url)')
        .eq('status', 'visible').order('created_at', { ascending: false }).limit(50)
      if (filter.tag) q = q.contains('tags', [filter.tag])
      if (filter.authorId) q = q.eq('author_id', filter.authorId)
      if (filter.concertId) q = q.eq('concert_id', filter.concertId)
      if (filter.reviews) q = q.or('concert_id.not.is.null,tags.cs.{후기}')
      if (filter.q) {
        const s = filter.q.replace(/[%,()]/g, ' ')
        q = q.or(`title.ilike.%${s}%,body.ilike.%${s}%`)
      }
      const rows = ok(await q) as Row[]
      const likes = ok(await sb.from('post_likes').select('post_id').eq('user_id', me).in('post_id', rows.map((r) => r.id))) as Row[]
      const liked = new Set(likes.map((l) => l.post_id as string))
      return rows.map((r) => toPost(r, liked))
    },
    async getPost(id) {
      const me = await uid()
      const r = ok(await sb.from('posts').select('*, author:profiles!posts_author_id_fkey(id, nickname, bio, avatar_url)').eq('id', id).single()) as Row
      const { data: like } = await sb.from('post_likes').select('post_id').eq('post_id', id).eq('user_id', me).maybeSingle()
      return toPost(r, new Set(like ? [id] : []))
    },
    async createPost({ title, body, tags, images, concertId }) {
      const me = await uid()
      const urls = await Promise.all(images.map((b) => api.uploadImage('posts', b)))
      const r = ok(await sb.from('posts').insert({ author_id: me, title, body, tags, image_urls: urls, concert_id: concertId ?? null }).select('id').single()) as Row
      return r.id
    },
    async deletePost(id) {
      ok(await sb.from('posts').delete().eq('id', id))
    },
    async toggleLike(postId) {
      return ok(await sb.rpc('toggle_post_like', { p: postId })) as boolean
    },
    async listComments(postId) {
      const rows = ok(await sb.from('comments')
        .select('*, author:profiles!comments_author_id_fkey(id, nickname, bio, avatar_url), reply:profiles!comments_reply_to_fkey(id, nickname)')
        .eq('post_id', postId).order('created_at')) as Row[]
      return rows.map((r) => ({
        id: r.id, postId: r.post_id, author: card(r.author), body: r.body, createdAt: r.created_at, edited: !!r.edited_at,
        parentId: r.parent_id, replyTo: r.reply ? { id: r.reply.id, nickname: r.reply.nickname } : null,
      }))
    },
    async addComment(postId, body, reply) {
      ok(await sb.from('comments').insert({ post_id: postId, author_id: await uid(), body, parent_id: reply?.parentId ?? null, reply_to: reply?.toUserId ?? null }))
    },

    async editPost(id, { title, body, tags }) {
      ok(await sb.rpc('edit_post', { p: id, new_title: title, new_body: body, new_tags: tags }))
    },
    async editComment(id, body) {
      ok(await sb.rpc('edit_comment', { c: id, new_body: body }))
    },

    async submitInquiry(input) {
      const me = await uid()
      ok(await sb.from('inquiries').insert({ user_id: me, category: input.category, answers: input.answers, body: input.body }))
    },
    async myInquiries() {
      const rows = ok(await sb.rpc('my_inquiries')) as Row[]
      return rows.map((r) => ({ id: r.id, category: r.category, body: r.body, status: r.status, answer: r.answer, answeredAt: r.answered_at, createdAt: r.created_at }))
    },

    // ─── 운영자 (RLS 가 is_admin() 으로 막으므로 여기서는 권한을 따로 확인하지 않는다) ───
    async adminReviewConcerts() {
      const rows = ok(await sb.from('concerts').select(ADMIN_CONCERT).eq('status', 'review')
        .order('review_score', { ascending: false, nullsFirst: false }).order('last_date')) as Row[]
      return rows.map(adminConcert)
    },
    async adminGetConcert(id) {
      return adminConcert(ok(await sb.from('concerts').select(ADMIN_CONCERT).eq('id', id).single()) as Row)
    },
    // 운영자 쓰기는 모두 서버 함수로 (표 직접 쓰기 권한 없음, 마이그 28·29). 기획사 목록 쌓기도 함수 안에서
    async adminPublishConcert(id, input) {
      ok(await sb.rpc('admin_publish_concert', { p_id: id, p_artist_ids: input.artistIds, p_ticket_open_at: input.ticketOpenAt }))
    },
    async adminHideConcert(id) {
      ok(await sb.rpc('admin_hide_concert', { p_id: id }))
    },
    async adminSearchInbox(q) {
      if (!q.trim()) return []
      const rows = ok(await sb.rpc('admin_search_inbox', { q })) as Row[]
      const ids = rows.map((r) => r.kopis_id)
      const known = ids.length ? ok(await sb.from('concerts').select('id, kopis_id, status').in('kopis_id', ids)) as Row[] : []
      return rows.map((r) => {
        const c = known.find((k) => k.kopis_id === r.kopis_id)
        return { kopisId: r.kopis_id, title: r.title, venue: r.venue, startDate: r.start_date, endDate: r.end_date, concert: c ? { id: c.id, status: c.status } : null }
      })
    },
    async adminImportConcert(kopisId) {
      const { data, error } = await sb.functions.invoke('import-concert', { body: { kopisId } })
      if (error) {
        const body = await (error as { context?: Response }).context?.json?.().catch(() => null)
        throw new Error(body?.error ?? error.message)
      }
      return (data as { id: string }).id
    },
    async adminSearchArtists(q, page = 0) {
      // or() 필터 문법을 깨는 문자(쉼표·괄호)와 와일드카드는 뺀다
      const term = q.trim().replace(/[,()%_*\\]/g, '')
      let req = sb.from('artists').select('id, name, name_ja, name_en, aliases, source').order('source').order('name').order('id').range(page * 40, page * 40 + 39)
      if (term) req = req.or(`name.ilike.%${term}%,name_en.ilike.%${term}%,name_ja.ilike.%${term}%`)
      return (ok(await req) as Row[]).map(adminArtist)
    },
    async adminGetArtist(id) {
      return adminArtist(ok(await sb.from('artists').select('id, name, name_ja, name_en, aliases, source').eq('id', id).single()) as Row)
    },
    async adminTicketTips() {
      const rows = ok(await sb.rpc('admin_ticket_tips')) as Row[]
      return rows.map((r) => ({
        id: r.id, concertId: r.concert_id, concertTitle: r.concert_title, currentOpenAt: r.current_open_at, openAt: r.open_at,
        sourceUrl: r.source_url, status: r.status, user: r.user_id ? { id: r.user_id, nickname: r.nickname } : null,
        createdAt: r.created_at, resolvedAt: r.resolved_at,
      }))
    },
    async adminResolveTicketTip(id, approve) {
      ok(await sb.rpc('admin_resolve_ticket_tip', { tip: id, approve }))
    },
    async adminTicketClicks(days) {
      const rows = ok(await sb.rpc('admin_ticket_clicks', { days })) as Row[]
      return rows.map((r) => ({ concertId: r.concert_id, concertTitle: r.concert_title, vendor: r.vendor, clicks: Number(r.clicks), users: Number(r.users) }))
    },
    async adminUsers(q, page, guests = false) {
      const rows = ok(await sb.rpc('admin_users', { q, lim: 50, off: page * 50, guests })) as Row[]
      return {
        total: Number(rows[0]?.total ?? 0),
        users: rows.map((r) => ({
          id: r.id, nickname: r.nickname, isGuest: r.is_guest, status: r.status, isAdmin: r.is_admin, login: r.login,
          createdAt: r.created_at, lastSeenAt: r.last_seen_at, sanctions: r.sanctions,
        })),
      }
    },
    async adminUserStats() {
      const r = (ok(await sb.rpc('admin_user_stats')) as Row[])[0] ?? {}
      return { members: Number(r.members ?? 0), guests: Number(r.guests ?? 0), active7d: Number(r.active_7d ?? 0), suspended: Number(r.suspended ?? 0), banned: Number(r.banned ?? 0) }
    },
    async adminUser(id) {
      const [u, s] = await Promise.all([sb.rpc('admin_user', { target: id }), sb.rpc('admin_user_sanctions', { target: id })])
      const r = (ok(u) as Row[])[0]
      return {
        user: r ? {
          id: r.id, nickname: r.nickname, bio: r.bio ?? '', isGuest: r.is_guest, status: r.status, isAdmin: r.is_admin, login: r.login,
          createdAt: r.created_at, lastSeenAt: r.last_seen_at, posts: r.posts, comments: r.comments, reportsAgainst: r.reports_against,
        } : null,
        sanctions: (ok(s) as Row[]).map((x) => ({ level: x.level, reason: x.reason, startsAt: x.starts_at, endsAt: x.ends_at })),
      }
    },
    async adminIds() {
      return ok(await sb.rpc('admin_ids')) as string[]
    },
    async listNotices() {
      return (ok(await sb.from('notices').select('id, title, body, starts_at, ends_at').order('starts_at', { ascending: false }).limit(100)) as Row[]).map(notice)
    },
    async getNotice(id) {
      return notice(ok(await sb.from('notices').select('id, title, body, starts_at, ends_at').eq('id', id).single()) as Row)
    },
    async adminPostNotice(title, body, endsAt, startsAt) {
      return ok(await sb.rpc('admin_post_notice', { title, body, ends_at: endsAt, starts_at: startsAt })) as string
    },
    async adminDeleteNotice(id) {
      ok(await sb.rpc('admin_delete_notice', { notice: id }))
    },
    async adminDeletePost(postId, reason) {
      ok(await sb.rpc('admin_delete_post', { post: postId, reason }))
    },
    async adminReports() {
      const rows = ok(await sb.rpc('admin_reports')) as Row[]
      return rows.map((r) => ({
        id: r.id, reason: r.reason, detail: r.detail, snapshot: r.snapshot, status: r.status, createdAt: r.created_at, resolvedAt: r.resolved_at,
        kind: r.kind, postId: r.post_id, priorSanctions: r.prior_sanctions,
        reporter: r.reporter_id ? { id: r.reporter_id, nickname: r.reporter_nickname } : null,
        target: r.target_id ? { id: r.target_id, nickname: r.target_nickname, status: r.target_status } : null,
      }))
    },
    async adminResolveReport(id, resolution, hideContent) {
      ok(await sb.rpc('admin_resolve_report', { r: id, resolution, hide_content: hideContent }))
    },
    async adminSanction(userId, level, reason, days) {
      ok(await sb.rpc('admin_sanction', { target: userId, level, reason, days: days ?? null }))
    },
    async adminMembership(userId) {
      const rows = ok(await sb.rpc('admin_membership', { target: userId })) as Row[]
      const r = rows[0]
      return r ? { subStartedAt: r.sub_started_at, subUntil: r.sub_until, months: r.months, methodLabel: r.method_label,
        subscriptionId: r.subscription_id, subState: r.sub_state, refundableKrw: r.refundable_krw, paidAt: r.paid_at, within7days: !!r.within_7days } : null
    },
    async adminRefund(subscriptionId, reason, amountKrw) {
      return fnCall(sb, 'pg-refund', { subscriptionId, reason, amountKrw })
    },
    async adminSetMembership(userId, action, months) {
      ok(await sb.rpc('admin_set_membership', { target: userId, kind: action, months: months ?? 1 }))
    },
    async adminInquiries() {
      const rows = ok(await sb.rpc('admin_inquiries')) as Row[]
      return rows.map((r) => ({
        id: r.id, user: { id: r.user_id, nickname: r.nickname ?? '탈퇴한 사용자', isGuest: !!r.is_guest }, category: r.category,
        answers: r.answers ?? {}, body: r.body, status: r.status, answer: r.answer, answeredAt: r.answered_at, createdAt: r.created_at,
      }))
    },
    async adminDeleteInquiry(id) {
      ok(await sb.rpc('admin_delete_inquiry', { p_id: id }))
    },
    async adminAnswerInquiry(id, answer) {
      const { data, error } = await sb.functions.invoke('answer-inquiry', { body: { inquiryId: id, answer } })
      if (error) {
        const body = await (error as { context?: Response }).context?.json?.().catch(() => null)
        throw new Error(body?.error ?? error.message)
      }
      return { mailed: !!(data as { mailed?: boolean })?.mailed }
    },
    async adminSaveArtist(input) {
      // 출처(source)·작성자는 서버 트리거가 정한다
      return ok(await sb.rpc('admin_save_artist', {
        p_id: input.id ?? null, p_name: input.name, p_name_ja: input.nameJa ?? null, p_name_en: input.nameEn ?? null,
        p_aliases: [...new Set(input.aliases.map((a) => a.trim()).filter(Boolean))].slice(0, 30),
      })) as string
    },
    async adminWords() {
      return ok(await sb.rpc('admin_words')) as { banned: BannedWord[]; allowed: string[] }
    },
    async adminAddWord(input) {
      ok(await sb.rpc('admin_add_word', input.allowed
        ? { p_word: input.word, p_allowed: true }
        : { p_word: input.word, p_allowed: false, p_match: input.match, p_category: input.category }))
    },
    async adminDeleteWord(allowed, word) {
      ok(await sb.rpc('admin_delete_word', { p_allowed: allowed, p_word: word }))
    },
    async adminTestText(text) {
      const r = (ok(await sb.rpc('admin_test_text', { t: text })) as Row[])[0]
      return { word: r?.word ?? null, masked: r?.masked ?? text }
    },
  }
  return api
}
