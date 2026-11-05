// 아이디 로그인 · 아이디 만들기 · 내 아이디 보기 · 아이디 찾기 (docs/로그인_계정_암호화_설계.md 5장)
// 로그인 전에도 부르므로 --no-verify-jwt 로 배포한다. set·me 는 아래에서 호출한 사람의 JWT 를 직접 확인한다
// 비밀번호는 DB 함수 check_login 이 auth 의 bcrypt 해시와 비교만 한다. 이메일은 앱에 돌려주지 않는다
import { admin, callerOf, cors, json } from '../_shared/supabase.ts'
import { blindIndex, decrypt, encrypt } from '../_shared/crypto.ts'
import { canMail, sendMail } from '../_shared/mail.ts'

const LOGIN_ID = /^[a-z][a-z0-9_]{3,19}$/ // 영문 소문자로 시작, 소문자·숫자·밑줄 4~20자 (앱 화면과 같은 규칙)
const WINDOW_MS = 10 * 60_000
const LIMIT = { id: 5, ip: 20, find: 5 } // 10분 동안 실패(찾기는 요청) 허용 횟수

type Db = ReturnType<typeof admin>
const clientIp = (req: Request) => req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
const recent = async (db: Db, key: string) =>
  (await db.from('login_attempts').select('key', { count: 'exact', head: true }).eq('key', key)
    .gt('at', new Date(Date.now() - WINDOW_MS).toISOString())).count ?? 0
const magicLink = async (db: Db, uid: string) => {
  const { data: u } = await db.auth.admin.getUserById(uid)
  const { data, error } = await db.auth.admin.generateLink({ type: 'magiclink', email: u.user!.email! })
  if (error) throw error
  return data.properties.hashed_token
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const body = await req.json().catch(() => ({}))
  const db = admin()
  try {
    switch (body.action) {
      // 아이디 + 비밀번호 → 일회용 로그인 토큰. 없는 아이디와 틀린 비밀번호는 같은 답을 준다
      case 'login': {
        const id = String(body.loginId ?? '').trim().toLowerCase()
        const pw = String(body.password ?? '')
        if (!id || !pw || id.length > 40 || pw.length > 200) return json({ error: 'invalid_login' }, 400)
        const idHmac = await blindIndex('login', id)
        const keys = [`id:${idHmac}`, `ip:${await blindIndex('ip', clientIp(req))}`]
        const [byId, byIp] = await Promise.all(keys.map((k) => recent(db, k)))
        if (byId >= LIMIT.id || byIp >= LIMIT.ip) return json({ error: 'too_many_attempts' }, 429)
        const { data: uid, error } = await db.rpc('check_login', { p_id_hmac: idHmac, p_password: pw })
        if (error) throw error
        if (!uid) {
          await db.from('login_attempts').insert(keys.map((key) => ({ key })))
          return json({ error: 'invalid_login' }, 400)
        }
        return json({ tokenHash: await magicLink(db, uid) })
      }

      // 아이디 만들기: 이메일로 가입한 사람만, 한 번만
      case 'set': {
        const user = await callerOf(req)
        if (!user || user.is_anonymous) return json({ error: 'not_authenticated' }, 401)
        const id = String(body.loginId ?? '').trim().toLowerCase()
        if (!LOGIN_ID.test(id)) return json({ error: 'login_id_format' }, 400)
        const { count: social } = await db.from('external_ids').select('user_id', { count: 'exact', head: true }).eq('user_id', user.id)
        if (social || !user.identities?.some((i) => i.provider === 'email')) return json({ error: 'login_id_not_needed' }, 400)
        const { error } = await db.from('login_ids').insert({
          user_id: user.id, id_hmac: await blindIndex('login', id), id_enc: await encrypt(user.id, 'login_id', id),
        })
        if (error?.code === '23505') return json({ error: /pkey/.test(error.message) ? 'login_id_exists' : 'login_id_taken' }, 409)
        if (error) throw error
        return json({ ok: true })
      }

      // 내 아이디 (MY > 내 정보). 본인에게만 복호화해 보여 준다
      case 'me': {
        const user = await callerOf(req)
        if (!user) return json({ error: 'not_authenticated' }, 401)
        const { data } = await db.from('login_ids').select('id_enc').eq('user_id', user.id).maybeSingle()
        return json({ loginId: data ? await decrypt(user.id, 'login_id', data.id_enc) : null })
      }

      // 아이디 찾기: 가입한 이메일로 아이디를 보낸다. 가입 여부는 화면에 알려 주지 않는다
      case 'find': {
        const email = String(body.email ?? '').trim()
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json({ error: 'bad_request' }, 400)
        if (!canMail(email)) return json({ ok: true, mailReady: false })
        const key = `find:${await blindIndex('ip', clientIp(req))}`
        if (await recent(db, key) >= LIMIT.find) return json({ error: 'too_many_attempts' }, 429)
        await db.from('login_attempts').insert({ key })
        const { data } = await db.rpc('login_id_by_email', { p_email: email })
        const row = data?.[0]
        if (row) {
          const id = await decrypt(row.user_id, 'login_id', row.id_enc)
          await sendMail(email, '[덕친소] 가입하신 아이디를 알려 드려요', `덕친소 아이디: ${id}\n\n직접 요청하지 않았다면 이 메일은 무시해 주세요.`)
        }
        return json({ ok: true, mailReady: true })
      }
    }
    return json({ error: 'bad_request' }, 400)
  } catch (e) {
    console.error('login_id_failed', body.action, (e as Error).message) // 아이디·비밀번호는 남기지 않는다
    return json({ error: 'server_error' }, 500)
  }
})
