import type { SupabaseClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { authRedirect, socialLoginUrl } from '@/lib/supabase'
import { CONSENT_ITEMS, CONSENT_VERSION, REQUIRED_KEYS } from '@/data/consent'
import type { AdminArtist, AdminConcert, Api, LoginMethod, BannedWord, Concert, Message, Post, UserCard } from './types'

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

const ext = (b: Blob) => (b.type.split('/')[1] ?? 'jpg').replace('jpeg', 'jpg')

const ADMIN_CONCERT = 'id, kopis_id, title, poster_url, venue_name, region, status, review_score, review_reasons, visit, cast_text, promoter, ticket_open_at, concert_schedules(starts_at), concert_artists(artist_id)'
const adminConcert = (r: Row): AdminConcert => ({
  id: r.id, kopisId: r.kopis_id, title: r.title, posterUrl: r.poster_url, venue: r.venue_name, region: r.region,
  schedules: (r.concert_schedules ?? []).map((s: Row) => new Date(s.starts_at).toISOString()).sort(),
  status: r.status, score: r.review_score, reasons: r.review_reasons ?? [], visit: r.visit, cast: r.cast_text, promoter: r.promoter,
  artistIds: (r.concert_artists ?? []).map((a: Row) => a.artist_id), ticketOpenAt: r.ticket_open_at,
})

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
    const paths = rows.map((m) => m.image_path).filter(Boolean)
    if (!paths.length) return new Map<string, string>()
    const { data } = await sb.storage.from('chat-media').createSignedUrls(paths, 3600)
    return new Map((data ?? []).map((d) => [d.path ?? '', d.signedUrl]))
  }

  const toPost = (p: Row, liked: Set<string>): Post => ({
    id: p.id, author: card(p.author), title: p.title, body: p.body, tags: p.tags ?? [], imageUrls: p.image_urls ?? [],
    likeCount: p.like_count, commentCount: p.comment_count, likedByMe: liked.has(p.id), createdAt: p.created_at, concertId: p.concert_id ?? null,
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
    async signInGuest() {
      const { error } = await sb.auth.signInAnonymously()
      if (error) throw error
    },
    async signInOAuth(provider) {
      const native = Capacitor.isNativePlatform()
      // 네이버·카카오: Supabase 기본 제공자가 아니라 서버 함수 social-login 이 직접 처리한다 (돌아오면 completeSocialLogin)
      if (provider === 'naver' || provider === 'kakao') {
        const url = socialLoginUrl(provider)
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
    async signInEmail(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password })
      if (error) throw error
    },
    async signInLoginId(loginId, password) {
      const { tokenHash } = await fn<{ tokenHash: string }>('login-id', { action: 'login', loginId, password })
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
    async findLoginId(email) {
      return fn<{ mailReady: boolean }>('login-id', { action: 'find', email })
    },
    async resetPassword(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${authRedirect()}?next=password` })
      if (error) throw error
    },
    async updatePassword(password) {
      const { error } = await sb.auth.updateUser({ password })
      if (error) throw error
    },
    async signOut() {
      await sb.auth.signOut()
    },
    async deleteAccount() {
      const { error } = await sb.functions.invoke('delete-account', { method: 'POST' })
      if (error) throw error
      await sb.auth.signOut({ scope: 'local' })
    },

    async getMe() {
      const id = await uid()
      const [{ data: s }, p, a, g, f, c, adm, login] = await Promise.all([
        sb.auth.getSession(),
        sb.from('profiles').select('*').eq('id', id).single(),
        sb.from('user_artists').select('artist_id').eq('user_id', id),
        sb.from('user_genres').select('genre_id').eq('user_id', id),
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
        communityAgreedAt: prof.community_agreed_at, notifyEnabled: prof.notify_enabled,
        artistIds: (ok(a) as Row[]).map((r) => r.artist_id),
        genreIds: (ok(g) as Row[]).map((r) => r.genre_id),
        favoriteIds: (ok(f) as Row[]).map((r) => r.concert_id),
        consents,
        consentsOk: REQUIRED_KEYS.every((k) => latest.get(k)?.agreed && latest.get(k)?.version === CONSENT_VERSION),
        // 네이버·카카오는 social-login 이 만든 계정이라 auth 의 제공자가 email 로 보인다 → my_login 의 social 이 우선
        loginMethod: prof.is_guest ? 'guest' : login.data?.social ?? (s.session?.user.app_metadata.provider as LoginMethod | undefined) ?? 'email',
        email: login.data?.social === 'kakao' ? null : s.session?.user.email ?? null,
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
      for (const [k, v] of Object.entries(patch.notify ?? {})) row[`notify_${k}`] = v
      if (patch.communityAgreed) {
        row.community_agreed_at = new Date().toISOString()
        ok(await sb.from('consents').insert({ user_id: id, item: 'community', version: CONSENT_VERSION, agreed: true }))
      }
      const { error } = await sb.from('profiles').update(row).eq('id', id)
      if (error) throw new Error(error.code === '23505' ? '이미 쓰고 있는 닉네임이에요.' : error.message)
    },
    async setMyArtists(ids) {
      const id = await uid()
      ok(await sb.from('user_artists').delete().eq('user_id', id))
      if (ids.length) ok(await sb.from('user_artists').insert(ids.map((artist_id) => ({ user_id: id, artist_id }))))
    },
    async setMyGenres(ids) {
      const id = await uid()
      ok(await sb.from('user_genres').delete().eq('user_id', id))
      if (ids.length) ok(await sb.from('user_genres').insert(ids.map((genre_id) => ({ user_id: id, genre_id }))))
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
      if (on) ok(await sb.from('favorites').upsert({ user_id: id, concert_id: concertId }))
      else ok(await sb.from('favorites').delete().eq('user_id', id).eq('concert_id', concertId))
    },
    async submitTicketTip(concertId, openAt, sourceUrl) {
      ok(await sb.rpc('submit_ticket_tip', { concert: concertId, open_at: openAt, source_url: sourceUrl }))
    },

    async getProfile(userId) {
      const me = await uid()
      const [p, a, g, f, fr, rq] = await Promise.all([
        sb.from('profiles').select('*').eq('id', userId).single(),
        sb.from('user_artists').select('artist_id').eq('user_id', userId),
        sb.from('user_genres').select('genre_id').eq('user_id', userId),
        sb.from('favorites').select('concert_id').eq('user_id', userId),
        sb.from('friendships').select('room_id').eq('user_a', me < userId ? me : userId).eq('user_b', me < userId ? userId : me).maybeSingle(),
        sb.from('friend_requests').select('from_user').eq('status', 'pending').gt('expires_at', new Date().toISOString())
          .or(`and(from_user.eq.${me},to_user.eq.${userId}),and(from_user.eq.${userId},to_user.eq.${me})`),
      ])
      const prof = ok(p) as Row
      const req = (ok(rq) as Row[])[0]
      const friend = ok(fr) as Row | null
      return {
        ...card(prof), bannerUrl: prof.banner_url, isGuest: prof.is_guest, profileSetupDone: prof.profile_setup_done,
        communityAgreedAt: prof.community_agreed_at, notifyEnabled: false,
        artistIds: (ok(a) as Row[]).map((r) => r.artist_id), genreIds: (ok(g) as Row[]).map((r) => r.genre_id),
        favoriteIds: (ok(f) as Row[]).map((r) => r.concert_id),
        relation: userId === me ? 'self' : friend ? 'friend' : req ? (req.from_user === me ? 'sent' : 'received') : 'none',
        roomId: friend?.room_id ?? null,
      }
    },
    async recommend() {
      const rows = ok(await sb.rpc('recommend_friends', { lim: 30 })) as Row[]
      return rows.map((r) => ({ ...card(r), score: r.score, commonArtists: r.common_artists }))
    },
    async searchUsers(q, filter) {
      const rows = ok(await sb.rpc('search_users', { q, genre: filter.genreId ?? null, artist: filter.artistId ?? null })) as Row[]
      return rows.map(card)
    },
    async sendFriendRequest(userId) {
      ok(await sb.rpc('send_friend_request', { target: userId }))
    },
    async listRequests() {
      const me = await uid()
      const rows = ok(await sb.from('friend_requests')
        .select('id, from_user, to_user, created_at, expires_at, from:profiles!friend_requests_from_user_fkey(id, nickname, bio, avatar_url), to:profiles!friend_requests_to_user_fkey(id, nickname, bio, avatar_url)')
        .eq('status', 'pending').gt('expires_at', new Date().toISOString())
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
        imageUrl: m.image_path ? urls.get(m.image_path) ?? null : null, createdAt: m.created_at,
      }))
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
    async markRead(roomId) {
      ok(await sb.rpc('mark_room_read', { r: roomId }))
    },
    subscribe(cb) {
      // RLS가 적용되므로 내가 볼 수 있는 행의 변경만 도착한다
      const ch = sb.channel('me')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (p) => cb({ type: 'message', roomId: (p.new as Row).room_id }))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, () => cb({ type: 'request' }))
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
        id: r.id, postId: r.post_id, author: card(r.author), body: r.body, createdAt: r.created_at,
        parentId: r.parent_id, replyTo: r.reply ? { id: r.reply.id, nickname: r.reply.nickname } : null,
      }))
    },
    async addComment(postId, body, reply) {
      ok(await sb.from('comments').insert({ post_id: postId, author_id: await uid(), body, parent_id: reply?.parentId ?? null, reply_to: reply?.toUserId ?? null }))
    },

    async submitInquiry(input) {
      const me = await uid()
      ok(await sb.rpc('ensure_support_room'))
      ok(await sb.from('inquiries').insert({ user_id: me, category: input.category, answers: input.answers, body: input.body }))
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
    async adminPublishConcert(id, input) {
      const c = ok(await sb.from('concerts').update({ status: 'published', source: 'admin', ticket_open_at: input.ticketOpenAt })
        .eq('id', id).select('promoter').single()) as Row
      ok(await sb.from('concert_artists').delete().eq('concert_id', id))
      if (input.artistIds.length) ok(await sb.from('concert_artists').insert(input.artistIds.map((a) => ({ concert_id: id, artist_id: a }))))
      // 게시한 공연의 기획사를 J-pop 기획사로 쌓는다 → 다음 수집부터 판별 근거(+1)
      const names = String(c.promoter ?? '').split(',').map((s) => s.trim()).filter((s) => s.length >= 2 && s.length <= 60)
      if (names.length) ok(await sb.from('jpop_promoters').upsert(names.map((name) => ({ name })), { onConflict: 'name', ignoreDuplicates: true }))
    },
    async adminHideConcert(id) {
      ok(await sb.from('concerts').update({ status: 'hidden' }).eq('id', id))
    },
    async adminSearchInbox(q) {
      const term = q.trim().replace(/[%_\\]/g, '')
      if (!term) return []
      const rows = ok(await sb.from('kopis_inbox').select('kopis_id, title, venue, start_date, end_date')
        .ilike('title', `%${term}%`).order('start_date').limit(50)) as Row[]
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
    async adminUsers(q, page) {
      const rows = ok(await sb.rpc('admin_users', { q, lim: 50, off: page * 50 })) as Row[]
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
    async adminInquiries() {
      const rows = ok(await sb.rpc('admin_inquiries')) as Row[]
      return rows.map((r) => ({
        id: r.id, user: { id: r.user_id, nickname: r.nickname ?? '탈퇴한 사용자', isGuest: !!r.is_guest }, category: r.category,
        answers: r.answers ?? {}, body: r.body, status: r.status, answer: r.answer, answeredAt: r.answered_at, createdAt: r.created_at,
      }))
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
      const row = { name: input.name.trim(), name_ja: input.nameJa?.trim() || null, name_en: input.nameEn?.trim() || null,
        aliases: [...new Set(input.aliases.map((a) => a.trim()).filter(Boolean))].slice(0, 30), source: 'admin' }
      const saved = input.id
        ? ok(await sb.from('artists').update(row).eq('id', input.id).select('id').single()) as Row
        : ok(await sb.from('artists').insert(row).select('id').single()) as Row
      return saved.id
    },
    async adminWords() {
      const [banned, allowed] = await Promise.all([
        sb.from('banned_words').select('word, match, category').order('created_at', { ascending: false }),
        sb.from('allowed_words').select('word').order('created_at', { ascending: false }),
      ])
      return { banned: ok(banned) as BannedWord[], allowed: (ok(allowed) as Row[]).map((r) => r.word) }
    },
    async adminAddWord(input) {
      const { error } = input.allowed
        ? await sb.from('allowed_words').insert({ word: input.word })
        : await sb.from('banned_words').insert({ word: input.word, match: input.match, category: input.category })
      if (error) throw new Error(error.code === '23505' ? 'word_exists' : error.message)
    },
    async adminDeleteWord(allowed, word) {
      ok(await sb.from(allowed ? 'allowed_words' : 'banned_words').delete().eq('word', word))
    },
    async adminTestText(text) {
      const r = (ok(await sb.rpc('admin_test_text', { t: text })) as Row[])[0]
      return { word: r?.word ?? null, masked: r?.masked ?? text }
    },
  }
  return api
}
