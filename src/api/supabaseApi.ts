import type { SupabaseClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import { Browser } from '@capacitor/browser'
import { authRedirect } from '@/lib/supabase'
import { CONSENT_ITEMS, CONSENT_VERSION, REQUIRED_KEYS } from '@/data/consent'
import type { Api, Concert, Message, Post, UserCard } from './types'

type Row = Record<string, any>

const card = (p: Row | null): UserCard => ({
  id: p?.id ?? '', nickname: p?.nickname ?? '알 수 없음', bio: p?.bio ?? '', avatarUrl: p?.avatar_url ?? null,
})

const ext = (b: Blob) => (b.type.split('/')[1] ?? 'jpg').replace('jpeg', 'jpg')

export function createSupabaseApi(sb: SupabaseClient): Api {
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
    likeCount: p.like_count, commentCount: p.comment_count, likedByMe: liked.has(p.id), createdAt: p.created_at,
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
      const { data, error } = await sb.auth.signInWithOAuth({
        provider, options: { redirectTo: authRedirect(), skipBrowserRedirect: native },
      })
      if (error) throw error
      // 앱: 구글은 웹뷰 로그인을 막으므로 시스템 브라우저로 열고 딥링크로 돌아온다 (기획서 3.4)
      if (native && data.url) await Browser.open({ url: data.url })
    },
    async signUpEmail(email, password) {
      const { data, error } = await sb.auth.signUp({ email, password, options: { emailRedirectTo: authRedirect() } })
      if (error) throw error
      return { needsConfirm: !data.session }
    },
    async signInEmail(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password })
      if (error) throw error
    },
    async resetPassword(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: authRedirect() })
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
      const [{ data: s }, p, a, g, f, c] = await Promise.all([
        sb.auth.getSession(),
        sb.from('profiles').select('*').eq('id', id).single(),
        sb.from('user_artists').select('artist_id').eq('user_id', id),
        sb.from('user_genres').select('genre_id').eq('user_id', id),
        sb.from('favorites').select('concert_id').eq('user_id', id),
        sb.from('consents').select('item, agreed, version').eq('user_id', id).order('created_at', { ascending: false }),
      ])
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
        email: s.session?.user.email ?? null,
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
        ticketOpenAt: r.ticket_open_at, genreId: r.genre_id,
        artistIds: r.concert_artists.map((a: Row) => a.artist_id),
        schedules: r.concert_schedules.map((s: Row) => new Date(s.starts_at).toISOString()).sort(),
        links: r.ticket_links,
      })).filter((c) => c.schedules.length)
    },
    async setFavorite(concertId, on) {
      const id = await uid()
      if (on) ok(await sb.from('favorites').upsert({ user_id: id, concert_id: concertId }))
      else ok(await sb.from('favorites').delete().eq('user_id', id).eq('concert_id', concertId))
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
    async createPost({ title, body, tags, images }) {
      const me = await uid()
      const urls = await Promise.all(images.map((b) => api.uploadImage('posts', b)))
      const r = ok(await sb.from('posts').insert({ author_id: me, title, body, tags, image_urls: urls }).select('id').single()) as Row
      return r.id
    },
    async deletePost(id) {
      ok(await sb.from('posts').delete().eq('id', id))
    },
    async toggleLike(postId) {
      return ok(await sb.rpc('toggle_post_like', { p: postId })) as boolean
    },
    async listComments(postId) {
      const rows = ok(await sb.from('comments').select('*, author:profiles!comments_author_id_fkey(id, nickname, bio, avatar_url)')
        .eq('post_id', postId).order('created_at')) as Row[]
      return rows.map((r) => ({ id: r.id, postId: r.post_id, author: card(r.author), body: r.body, createdAt: r.created_at }))
    },
    async addComment(postId, body) {
      ok(await sb.from('comments').insert({ post_id: postId, author_id: await uid(), body }))
    },

    async submitInquiry(input) {
      const me = await uid()
      ok(await sb.rpc('ensure_support_room'))
      ok(await sb.from('inquiries').insert({ user_id: me, category: input.category, answers: input.answers, body: input.body }))
    },
  }
  return api
}
