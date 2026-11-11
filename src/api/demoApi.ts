// Supabase 미연결 시 쓰는 데모 백엔드. 같은 Api 계약을 브라우저 localStorage 로 흉내 낸다.
// 다른 사용자는 DEMO_USERS(가상)이고, 친구 수락·채팅 답장은 잠시 뒤 자동으로 온다.
import { CONSENT_VERSION, REQUIRED_KEYS } from '@/data/consent'
import { LOGIN_ID } from './types'
import { ARTISTS, AUTO_REPLIES, DEMO_POSTS, DEMO_USERS, GENRES, buildConcerts } from './demoData'
import type { Api, Artist, Concert, LoginMethod, NotifyPrefs, Message, Post, Profile, RealtimeEvent, UserCard } from './types'

// pnpm fetch:opendata 로 받은 실제 공연·아티스트(KOPIS·MusicBrainz). 파일이 없거나 공연이 0건이면 샘플을 쓴다
type OpenData = { fetchedAt: string; artists: Artist[]; concerts: Concert[] }
const openData = (Object.values(import.meta.glob('./openData.json', { eager: true, import: 'default' }))[0] ?? null) as OpenData | null
const real = openData?.concerts.length ? openData : null
const allArtists = () => real?.artists ?? ARTISTS
const allConcerts = () => real?.concerts ?? buildConcerts(Date.now())
const noAdmin = async (): Promise<never> => { throw new Error('demo_admin') }

type Acc = Profile & {
  artistIds: string[]; genreIds: number[]; favoriteIds: string[]
  consents: { item: string; agreed: boolean; version: string }[]
  email: string | null; password: string | null
  method: LoginMethod; loginId: string | null
  notify?: Partial<NotifyPrefs>
}
type Req = { id: string; from: string; to: string; status: 'pending' | 'accepted' | 'declined'; createdAt: number; expiresAt: number }
type RoomRow = { id: string; kind: 'dm' | 'support'; members: string[]; lastRead: Record<string, number>; createdAt: number }
type MsgRow = Omit<Message, 'createdAt'> & { createdAt: number }
type PostRow = { id: string; authorId: string; title: string; body: string; tags: string[]; imageUrls: string[]; likes: string[]; createdAt: number; concertId?: string | null; edited?: boolean }
type CommentRow = { id: string; postId: string; authorId: string; body: string; createdAt: number; parentId?: string | null; replyTo?: string | null; edited?: boolean }
type DB = {
  session: string | null
  accounts: Record<string, Acc>
  requests: Req[]
  friendships: { a: string; b: string; roomId: string }[]
  rooms: RoomRow[]
  messages: MsgRow[]
  blocks: { blocker: string; blocked: string }[]
  posts: PostRow[]
  comments: CommentRow[]
  reports: unknown[]
  inquiries: unknown[]
}

const KEY = 'duckchinso-demo-v2'
const DAY = 86_400_000
const id = () => Math.random().toString(36).slice(2, 10)
const iso = (ms: number) => new Date(ms).toISOString()
const wait = (ms = 120) => new Promise((r) => setTimeout(r, ms))

const fresh = (): DB => {
  const t = Date.now()
  return {
    session: null, accounts: {}, requests: [], friendships: [], rooms: [], messages: [], blocks: [], reports: [], inquiries: [],
    posts: DEMO_POSTS.map((p, i) => ({ id: `p${i + 1}`, authorId: p.author, title: p.title, body: p.body, tags: p.tags, imageUrls: [], likes: DEMO_USERS.slice(0, 5 - i).map((u) => u.id), createdAt: t - (i + 1) * 3 * 3_600_000 })),
    comments: [{ id: 'cm1', postId: 'p1', authorId: 'u6', body: '저도 갔어요! 앵콜 최고였죠', createdAt: t - 2 * 3_600_000 }],
  }
}

export function createDemoApi(): Api {
  let db: DB
  try { db = JSON.parse(localStorage.getItem(KEY) ?? '') as DB } catch { db = fresh() }
  if (!db?.posts) db = fresh()
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* 저장 공간 초과: 데모라서 메모리 상태만 유지 */ }
  }
  const listeners = new Set<(e: RealtimeEvent) => void>()
  const authListeners = new Set<(id: string | null) => void>()
  const emit = (e: RealtimeEvent) => listeners.forEach((l) => l(e))
  const setSession = (sid: string | null) => { db.session = sid; save(); authListeners.forEach((l) => l(sid)) }

  const me = () => {
    if (!db.session || !db.accounts[db.session]) throw new Error('not_authenticated')
    return db.accounts[db.session]
  }
  const demoUser = (uid: string) => DEMO_USERS.find((u) => u.id === uid)
  const card = (uid: string | null): UserCard => {
    const a = uid ? db.accounts[uid] : undefined
    if (a) return { id: a.id, nickname: a.nickname, bio: a.bio, avatarUrl: a.avatarUrl }
    const u = uid ? demoUser(uid) : undefined
    return u ? { id: u.id, nickname: u.nickname, bio: u.bio, avatarUrl: null } : { id: uid ?? '', nickname: '알 수 없음', bio: '', avatarUrl: null }
  }
  const prefsOf = (uid: string) => {
    const a = db.accounts[uid]
    if (a) return { artistIds: a.artistIds, genreIds: a.genreIds, favoriteIds: a.favoriteIds }
    const u = demoUser(uid)!
    const concerts = allConcerts()
    return { artistIds: u.artistIds, genreIds: u.genreIds, favoriteIds: u.favoriteIdx.map((i) => concerts[i]?.id).filter(Boolean) }
  }
  const blockedBetween = (a: string, b: string) => db.blocks.some((x) => (x.blocker === a && x.blocked === b) || (x.blocker === b && x.blocked === a))
  const friendOf = (a: string, b: string) => db.friendships.find((f) => (f.a === a && f.b === b) || (f.a === b && f.b === a))
  const pending = (a: string, b: string) => db.requests.find((r) => r.status === 'pending' && r.expiresAt > Date.now() && ((r.from === a && r.to === b) || (r.from === b && r.to === a)))

  const pushMsg = (roomId: string, senderId: string | null, kind: MsgRow['kind'], body: string, imageUrl: string | null = null) => {
    const m: MsgRow = { id: id(), roomId, senderId, kind, body, imageUrl, createdAt: Date.now() }
    db.messages.push(m)
    const room = db.rooms.find((r) => r.id === roomId)
    if (room && senderId) room.lastRead[senderId] = m.createdAt
    save()
    emit({ type: 'message', roomId })
  }
  const befriend = (a: string, b: string) => {
    let room = db.rooms.find((r) => r.kind === 'dm' && r.members.includes(a) && r.members.includes(b))
    if (!room) {
      room = { id: id(), kind: 'dm', members: [a, b], lastRead: { [a]: Date.now(), [b]: Date.now() }, createdAt: Date.now() }
      db.rooms.push(room)
    }
    if (!friendOf(a, b)) db.friendships.push({ a, b, roomId: room.id })
    pushMsg(room.id, null, 'system', '친구가 되었어요. 가볍게 인사를 건네 보세요.')
    return room.id
  }

  const createAccount = (fields: Partial<Acc>) => {
    const aid = fields.id ?? `me_${id()}`
    const guest = fields.isGuest ?? true
    db.accounts[aid] = {
      id: aid, nickname: `${guest ? '익명의 팬' : '덕친'}${Math.floor(1000 + Math.random() * 9000)}`, bio: '', avatarUrl: null, bannerUrl: null,
      isGuest: guest, profileSetupDone: false, communityAgreedAt: null, notifyEnabled: true,
      artistIds: [], genreIds: [], favoriteIds: [], consents: [], email: null, password: null, method: 'email', loginId: null, ...fields,
    }
    // 처음 들어온 계정에 받은 친구 요청 2건을 넣어 둔다
    const t = Date.now()
    db.requests.push(
      { id: id(), from: 'u6', to: aid, status: 'pending', createdAt: t - 3_600_000, expiresAt: t + 3 * DAY },
      { id: id(), from: 'u7', to: aid, status: 'pending', createdAt: t - DAY, expiresAt: t + 2 * DAY },
    )
    setSession(aid)
  }

  const toPost = (p: PostRow, uid: string): Post => ({
    id: p.id, author: card(p.authorId), title: p.title, body: p.body, tags: p.tags, imageUrls: p.imageUrls,
    likeCount: p.likes.length, commentCount: db.comments.filter((c) => c.postId === p.id).length,
    likedByMe: p.likes.includes(uid), createdAt: iso(p.createdAt), concertId: p.concertId ?? null, edited: !!p.edited,
  })

  const api: Api = {
    mode: 'demo',

    async sessionUserId() { return db.session && db.accounts[db.session] ? db.session : null },
    onAuthChange(cb) { authListeners.add(cb); return () => authListeners.delete(cb) },
    async signInGuest() { await wait(); createAccount({ isGuest: true }) },
    async signInOAuth(provider) {
      await wait(400)
      const aid = `demo_${provider}`
      if (db.accounts[aid]) setSession(aid)
      else createAccount({ id: aid, isGuest: false, method: provider, email: provider === 'kakao' ? null : `${provider}@demo.duckchinso` })
    },
    async checkLoginId(loginId) {
      await wait()
      return !Object.values(db.accounts).some((a) => a.loginId === loginId)
    },
    async sendEmailCode() { await wait(); return { expiresIn: 300 } },
    async verifyEmailCode(email, code) {
      await wait()
      if (code !== 'DEMO12') throw new Error('email_code_invalid')
      return email
    },
    async signUpEmail(ticket, loginId, password) {
      await wait()
      if (Object.values(db.accounts).some((a) => a.email === ticket)) throw new Error('email_taken')
      if (Object.values(db.accounts).some((a) => a.loginId === loginId)) throw new Error('login_id_taken')
      createAccount({ isGuest: false, email: ticket, password, loginId })
    },
    async signInEmail(email, password) {
      await wait()
      const a = Object.values(db.accounts).find((x) => x.email === email && x.password === password)
      if (!a) throw new Error('Invalid login credentials')
      setSession(a.id)
    },
    async signInLoginId(loginId, password) {
      await wait()
      const a = Object.values(db.accounts).find((x) => x.loginId === loginId.trim().toLowerCase() && x.password === password)
      if (!a) throw new Error('invalid_login')
      setSession(a.id)
    },
    async completeSocialLogin() { await wait() },
    async setLoginId(loginId) {
      await wait()
      const id = loginId.trim().toLowerCase()
      if (!LOGIN_ID.test(id)) throw new Error('login_id_format')
      if (Object.values(db.accounts).some((a) => a.loginId === id)) throw new Error('login_id_taken')
      me().loginId = id
      save()
    },
    async myLoginId() { return me().loginId },
    async findLoginId() { await wait(); return { mailReady: false } },
    async requestPasswordReset() { await wait() },
    async resetPasswordWithCode() { await wait() }, // 데모: 메일이 없어 어떤 코드든 통과
    async updatePassword(password) { await wait(); me().password = password; save() },
    async signOut() { setSession(null) },
    async deleteAccount() {
      const uid = me().id
      // 실제 DB의 on delete cascade 와 같은 범위: 이 계정 ID가 들어간 행만 지운다
      delete db.accounts[uid]
      db.requests = db.requests.filter((r) => r.from !== uid && r.to !== uid)
      db.friendships = db.friendships.filter((f) => f.a !== uid && f.b !== uid)
      db.messages = db.messages.filter((m) => m.senderId !== uid)
      db.rooms.forEach((r) => { r.members = r.members.filter((m) => m !== uid) })
      db.rooms = db.rooms.filter((r) => r.members.some((m) => db.accounts[m] || demoUser(m)))
      db.blocks = db.blocks.filter((b) => b.blocker !== uid && b.blocked !== uid)
      db.posts = db.posts.filter((p) => p.authorId !== uid)
      db.posts.forEach((p) => { p.likes = p.likes.filter((l) => l !== uid) })
      db.comments = db.comments.filter((c) => c.authorId !== uid)
      setSession(null)
    },

    async getMe() {
      const a = me()
      const latest = new Map<string, Acc['consents'][number]>()
      ;[...a.consents].reverse().forEach((c) => !latest.has(c.item) && latest.set(c.item, c))
      const { password: _p, consents: _c, method, loginId, ...rest } = a
      return {
        ...rest,
        consents: Object.fromEntries([...latest].map(([k, v]) => [k, v.agreed])),
        consentsOk: REQUIRED_KEYS.every((k) => latest.get(k)?.agreed && latest.get(k)?.version === CONSENT_VERSION),
        loginMethod: a.isGuest ? 'guest' : method,
        needsLoginId: !a.isGuest && method === 'email' && !loginId,
        notify: { friend: true, like: true, comment: true, concert: true, ...a.notify },
        isAdmin: false,
      }
    },
    async updateMe(patch) {
      const a = me()
      const { communityAgreed, notify, ...rest } = patch
      if (notify) a.notify = { ...a.notify, ...notify }
      if (rest.nickname && Object.values(db.accounts).some((x) => x.id !== a.id && x.nickname === rest.nickname)) throw new Error('이미 쓰고 있는 닉네임이에요.')
      Object.assign(a, rest)
      if (communityAgreed) {
        a.communityAgreedAt = iso(Date.now())
        a.consents.push({ item: 'community', agreed: true, version: CONSENT_VERSION })
      }
      save()
    },
    async setMyArtists(ids) { me().artistIds = ids.slice(0, 5); save() },
    async setMyGenres(ids) { me().genreIds = ids.slice(0, 5); save() },
    async saveConsents(values) {
      const a = me()
      Object.entries(values).forEach(([item, agreed]) => a.consents.push({ item, agreed, version: CONSENT_VERSION }))
      save()
    },
    async uploadImage(_kind, file) {
      return new Promise<string>((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(r.result as string)
        r.onerror = () => rej(r.error)
        r.readAsDataURL(file)
      })
    },

    async listGenres() { return GENRES },
    async listArtists() { return allArtists() },
    async listConcerts() { return allConcerts() },
    async openDataUpdatedAt() { return real?.fetchedAt ?? null },
    async setFavorite(concertId, on) {
      const a = me()
      a.favoriteIds = on ? [...new Set([...a.favoriteIds, concertId])] : a.favoriteIds.filter((x) => x !== concertId)
      save()
    },
    async submitTicketTip() {
      await wait()
      if (me().isGuest) throw new Error('members_only')
    },

    async getProfile(uid) {
      const my = me().id
      const a = db.accounts[uid]
      const f = friendOf(my, uid)
      const p = pending(my, uid)
      return {
        ...card(uid), bannerUrl: a?.bannerUrl ?? null, isGuest: a?.isGuest ?? false, profileSetupDone: true,
        communityAgreedAt: null, notifyEnabled: false, ...prefsOf(uid), upcomingCount: 0, // 데모는 관심 공연을 가리지 않는다
        relation: uid === my ? 'self' : f ? 'friend' : p ? (p.from === my ? 'sent' : 'received') : 'none',
        roomId: f?.roomId ?? null,
      }
    },
    async recommend() {
      const a = me()
      const jac = (x: (string | number)[], y: (string | number)[]) => {
        const u = new Set([...x, ...y]).size
        return u ? x.filter((v) => y.includes(v)).length / u : 0
      }
      return DEMO_USERS
        .filter((u) => !blockedBetween(a.id, u.id) && !friendOf(a.id, u.id) && !pending(a.id, u.id))
        .map((u) => ({
          ...card(u.id), score: 0.7 * jac(a.artistIds, u.artistIds) + 0.3 * jac(a.genreIds, u.genreIds),
          commonArtists: u.artistIds.filter((x) => a.artistIds.includes(x)).length,
        }))
        .sort((x, y) => y.score - x.score)
    },
    async searchUsers(q, filter) {
      const a = me()
      const s = q.trim().toLowerCase()
      return DEMO_USERS
        .filter((u) => !blockedBetween(a.id, u.id))
        .filter((u) => !s || u.nickname.toLowerCase().includes(s) || u.bio.toLowerCase().includes(s))
        .filter((u) => !filter.genreId || u.genreIds.includes(filter.genreId))
        .filter((u) => !filter.artistId || u.artistIds.includes(filter.artistId))
        .map((u) => card(u.id))
    },
    async sendFriendRequest(uid) {
      const a = me()
      if (blockedBetween(a.id, uid)) throw new Error('unavailable')
      if (friendOf(a.id, uid)) throw new Error('already_friends')
      if (pending(a.id, uid)) throw new Error('duplicate')
      const r: Req = { id: id(), from: a.id, to: uid, status: 'pending', createdAt: Date.now(), expiresAt: Date.now() + 3 * DAY }
      db.requests.push(r)
      save()
      emit({ type: 'request' })
      if (demoUser(uid)?.willAccept) {
        setTimeout(() => {
          if (r.status !== 'pending' || blockedBetween(a.id, uid)) return
          r.status = 'accepted'
          befriend(a.id, uid)
          emit({ type: 'request' })
        }, 2500)
      }
    },
    async listRequests() {
      const a = me()
      return db.requests
        .filter((r) => r.status === 'pending' && r.expiresAt > Date.now() && (r.from === a.id || r.to === a.id))
        .sort((x, y) => y.createdAt - x.createdAt)
        .map((r) => ({ id: r.id, direction: r.to === a.id ? 'in' : 'out', user: card(r.to === a.id ? r.from : r.to), createdAt: iso(r.createdAt), expiresAt: iso(r.expiresAt) }))
    },
    async respondRequest(rid, accept) {
      const a = me()
      const r = db.requests.find((x) => x.id === rid && x.to === a.id && x.status === 'pending')
      if (!r) throw new Error('not_found')
      r.status = accept ? 'accepted' : 'declined'
      save()
      return accept ? befriend(a.id, r.from) : null
    },
    async listFriends() {
      const a = me()
      return db.friendships.filter((f) => f.a === a.id || f.b === a.id)
        .map((f) => ({ ...card(f.a === a.id ? f.b : f.a), roomId: f.roomId }))
    },
    async removeFriend(uid) {
      const a = me()
      db.friendships = db.friendships.filter((f) => f !== friendOf(a.id, uid))
      save()
    },
    async block(uid) {
      const a = me()
      if (!db.blocks.some((b) => b.blocker === a.id && b.blocked === uid)) db.blocks.push({ blocker: a.id, blocked: uid })
      db.friendships = db.friendships.filter((f) => f !== friendOf(a.id, uid))
      db.requests.forEach((r) => { if (r.status === 'pending' && [r.from, r.to].includes(uid) && [r.from, r.to].includes(a.id)) r.status = 'declined' })
      save()
    },
    async unblock(uid) {
      const a = me()
      db.blocks = db.blocks.filter((b) => !(b.blocker === a.id && b.blocked === uid))
      save()
    },
    async listBlocked() {
      const a = me()
      return db.blocks.filter((b) => b.blocker === a.id).map((b) => card(b.blocked))
    },
    async report(target, reason, detail) {
      db.reports.push({ reporter: me().id, ...target, reason, detail, at: Date.now() })
      save()
    },

    async listRooms() {
      const a = me()
      return db.rooms
        .filter((r) => r.members.includes(a.id))
        .map((r) => {
          const partnerId = r.members.find((m) => m !== a.id) ?? null
          const msgs = db.messages.filter((m) => m.roomId === r.id)
          const last = msgs[msgs.length - 1]
          const read = r.lastRead[a.id] ?? 0
          return {
            id: r.id, kind: r.kind,
            partner: r.kind === 'support' ? { id: null, nickname: '덕친소 운영팀', avatarUrl: null } : { ...card(partnerId), id: partnerId },
            lastBody: last?.body ?? null, lastKind: last?.kind ?? null, lastAt: iso(last?.createdAt ?? r.createdAt),
            unread: msgs.filter((m) => m.createdAt > read && m.senderId !== a.id && m.kind !== 'system').length,
            canSend: r.kind === 'support' || (!!partnerId && !!friendOf(a.id, partnerId) && !blockedBetween(a.id, partnerId)),
          }
        })
        .filter((r) => !r.partner.id || !db.blocks.some((b) => b.blocker === a.id && b.blocked === r.partner.id))
        .sort((x, y) => y.lastAt.localeCompare(x.lastAt))
    },
    async listMessages(roomId) {
      return db.messages.filter((m) => m.roomId === roomId).map((m) => ({ ...m, createdAt: iso(m.createdAt) }))
    },
    async sendText(roomId, body) {
      const a = me()
      const room = db.rooms.find((r) => r.id === roomId)
      if (!room) throw new Error('not_found')
      pushMsg(roomId, a.id, 'text', body)
      const partner = room.members.find((m) => m !== a.id)
      if (room.kind === 'dm' && partner && demoUser(partner)) {
        setTimeout(() => {
          if (!friendOf(a.id, partner) || blockedBetween(a.id, partner)) return
          const n = db.messages.filter((m) => m.roomId === roomId && m.senderId === partner).length
          pushMsg(roomId, partner, 'text', AUTO_REPLIES[n % AUTO_REPLIES.length])
        }, 1500)
      }
    },
    async sendImage(roomId, file) {
      pushMsg(roomId, me().id, 'image', '', await api.uploadImage('posts', file))
    },
    async markRead(roomId) {
      const room = db.rooms.find((r) => r.id === roomId)
      if (room) { room.lastRead[me().id] = Date.now(); save() }
    },
    async deleteMessage(mid) {
      const m = db.messages.find((x) => x.id === mid && x.senderId === me().id && !x.deleted)
      if (!m) throw new Error('not_found')
      Object.assign(m, { kind: 'text', body: '삭제된 메시지예요', imageUrl: null, deleted: true })
      save()
    },
    subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb) },

    async listPosts(filter) {
      const a = me()
      const s = filter.q?.trim().toLowerCase()
      return db.posts
        .filter((p) => p.authorId === a.id || !blockedBetween(a.id, p.authorId))
        .filter((p) => !filter.tag || p.tags.includes(filter.tag))
        .filter((p) => !filter.authorId || p.authorId === filter.authorId)
        .filter((p) => !filter.concertId || p.concertId === filter.concertId)
        .filter((p) => !filter.reviews || !!p.concertId || p.tags.includes('후기'))
        .filter((p) => !s || `${p.title} ${p.body} ${p.tags.join(' ')}`.toLowerCase().includes(s))
        .sort((x, y) => y.createdAt - x.createdAt)
        .map((p) => toPost(p, a.id))
    },
    async getPost(pid) {
      const p = db.posts.find((x) => x.id === pid)
      if (!p) throw new Error('not_found')
      return toPost(p, me().id)
    },
    async createPost({ title, body, tags, images, concertId }) {
      const a = me()
      const urls = await Promise.all(images.map((b) => api.uploadImage('posts', b)))
      const p: PostRow = { id: id(), authorId: a.id, title, body, tags, imageUrls: urls, likes: [], createdAt: Date.now(), concertId: concertId ?? null }
      db.posts.push(p)
      save()
      return p.id
    },
    async deletePost(pid) {
      const a = me()
      db.posts = db.posts.filter((p) => !(p.id === pid && p.authorId === a.id))
      save()
    },
    async toggleLike(pid) {
      const a = me()
      const p = db.posts.find((x) => x.id === pid)
      if (!p) throw new Error('not_found')
      const on = !p.likes.includes(a.id)
      p.likes = on ? [...p.likes, a.id] : p.likes.filter((l) => l !== a.id)
      save()
      return on
    },
    async listComments(pid) {
      const a = me()
      return db.comments.filter((c) => c.postId === pid && !blockedBetween(a.id, c.authorId))
        .map((c) => ({ id: c.id, postId: c.postId, author: card(c.authorId), body: c.body, createdAt: iso(c.createdAt), edited: !!c.edited, parentId: c.parentId ?? null, replyTo: c.replyTo ? { id: c.replyTo, nickname: card(c.replyTo).nickname } : null }))
    },
    async addComment(pid, body, reply) {
      const parent = reply && db.comments.find((c) => c.id === reply.parentId)
      db.comments.push({ id: id(), postId: pid, authorId: me().id, body, createdAt: Date.now(), parentId: parent ? parent.parentId ?? parent.id : null, replyTo: reply?.toUserId ?? null })
      save()
    },
    async editPost(pid, { title, body, tags }) {
      const p = db.posts.find((x) => x.id === pid && x.authorId === me().id)
      if (!p) throw new Error('not_found')
      Object.assign(p, { title, body, tags, edited: true })
      save()
    },
    async editComment(cid, body) {
      const c = db.comments.find((x) => x.id === cid && x.authorId === me().id)
      if (!c) throw new Error('not_found')
      Object.assign(c, { body, edited: true })
      save()
    },

    async submitInquiry(input) {
      const a = me()
      db.inquiries.push({ userId: a.id, ...input, at: Date.now() })
      let room = db.rooms.find((r) => r.kind === 'support' && r.members.includes(a.id))
      if (!room) {
        room = { id: id(), kind: 'support', members: [a.id], lastRead: { [a.id]: Date.now() }, createdAt: Date.now() }
        db.rooms.push(room)
        pushMsg(room.id, null, 'system', '문의 답변이 이 대화방으로 도착해요.')
      }
      const rid = room.id
      setTimeout(() => pushMsg(rid, null, 'text', '문의 주셔서 감사합니다. 데모 모드라 자동 답변이 왔어요. 실제 서비스에서는 운영자가 확인 후 답변하고 메일로도 알려 드려요.'), 2000)
      save()
    },

    // 데모에는 운영자가 없다 (메뉴도 보이지 않음)
    adminReviewConcerts: noAdmin, adminGetConcert: noAdmin, adminPublishConcert: noAdmin, adminHideConcert: noAdmin,
    adminSearchInbox: noAdmin, adminImportConcert: noAdmin, adminSearchArtists: noAdmin, adminGetArtist: noAdmin, adminSaveArtist: noAdmin,
    adminReports: noAdmin, adminResolveReport: noAdmin, adminSanction: noAdmin, adminTicketTips: noAdmin, adminResolveTicketTip: noAdmin, adminUsers: noAdmin, adminUserStats: noAdmin, adminUser: noAdmin, adminDeletePost: noAdmin, adminInquiries: noAdmin, adminAnswerInquiry: noAdmin, adminDeleteInquiry: noAdmin,
    adminWords: noAdmin, adminAddWord: noAdmin, adminDeleteWord: noAdmin, adminTestText: noAdmin,
  }
  return api
}
