// 이메일 가입 · 아이디 로그인 · 아이디 만들기 · 내 아이디 보기 · 아이디 찾기 (docs/로그인_계정_암호화_설계.md 5장)
// 로그인 전에도 부르므로 --no-verify-jwt 로 배포한다. set·me 는 아래에서 호출한 사람의 JWT 를 직접 확인한다
// 비밀번호는 DB 함수 check_login 이 auth 의 bcrypt 해시와 비교만 한다. 이메일은 앱에 돌려주지 않는다
import { admin, callerOf, cors, json } from '../_shared/supabase.ts'
import { blindIndex, decrypt, emailCode, encrypt, signState, verifyState } from '../_shared/crypto.ts'
import { canMail, sendMail } from '../_shared/mail.ts'
import { verifyCaptcha } from '../_shared/captcha.ts'

const LOGIN_ID = /^[a-z][a-z0-9_]{3,19}$/ // 영문 소문자로 시작, 소문자·숫자·밑줄 4~20자 (앱 화면과 같은 규칙)
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const WINDOW_MS = 10 * 60_000
const CODE_TTL_SEC = 300
const LIMIT = { id: 5, ip: 20, find: 5, check: 30, codeEmail: 5, codeIp: 20, codeTries: 5 } // 10분 동안 허용 횟수 (codeTries: 코드 하나당 입력 횟수)

type Db = ReturnType<typeof admin>
const clientIp = (req: Request) => req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
const recent = async (db: Db, key: string, windowMs = WINDOW_MS) =>
  (await db.from('login_attempts').select('key', { count: 'exact', head: true }).eq('key', key)
    .gt('at', new Date(Date.now() - windowMs).toISOString())).count ?? 0
// 이메일당 메일 발송 제한 (메일 폭탄 방지): 1시간 3회, 하루 5회. 넘으면 true
const HOUR = 60 * 60_000
const mailFlood = async (db: Db, emailKey: string) =>
  (await recent(db, emailKey, HOUR)) >= 3 || (await recent(db, emailKey, 24 * HOUR)) >= 5
// 비밀번호 찾기 대상: 아이디의 계정이 있고, 그 계정의 가입 이메일이 입력한 이메일과 같을 때만 사용자 id
const resetTarget = async (db: Db, idHmac: string, email: string) => {
  const { data } = await db.from('login_ids').select('user_id').eq('id_hmac', idHmac).maybeSingle()
  if (!data) return null
  const { data: u } = await db.auth.admin.getUserById(data.user_id)
  return u.user?.email?.toLowerCase() === email ? data.user_id as string : null
}
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
      // 가입 1단계: 아이디 중복 확인. 아이디를 하나씩 찔러 보지 못하게 IP당 횟수를 제한한다
      case 'check_id': {
        const id = String(body.loginId ?? '').trim().toLowerCase()
        if (!LOGIN_ID.test(id)) return json({ error: 'login_id_format' }, 400)
        const key = `check:${await blindIndex('ip', clientIp(req))}`
        if (await recent(db, key) >= LIMIT.check) return json({ error: 'too_many_attempts' }, 429)
        await db.from('login_attempts').insert({ key })
        const { data } = await db.from('login_ids').select('user_id').eq('id_hmac', await blindIndex('login', id)).maybeSingle()
        return json({ available: !data })
      }

      // 가입 2단계: 인증 코드 발송. 이미 가입된 이메일이면 코드 대신 안내 메일을 보내고 화면에는 같은 답을 준다 (가입 여부를 알려 주지 않는다)
      case 'email_code': {
        const email = String(body.email ?? '').trim().toLowerCase()
        if (!EMAIL.test(email) || email.length > 254) return json({ error: 'bad_request' }, 400)
        if (!canMail(email)) return json({ error: 'mail_not_ready' }, 503)
        const emailHmac = await blindIndex('email', email)
        const keys = [`code:${emailHmac}`, `codeip:${await blindIndex('ip', clientIp(req))}`]
        const [byEmail, byIp] = await Promise.all(keys.map((k) => recent(db, k)))
        if (byEmail >= LIMIT.codeEmail || byIp >= LIMIT.codeIp) return json({ error: 'too_many_attempts' }, 429)
        await db.from('login_attempts').insert(keys.map((key) => ({ key })))
        await db.from('email_codes').delete().lt('expires_at', new Date().toISOString())

        const { data: registered, error } = await db.rpc('email_registered', { p_email: email })
        if (error) throw error
        let sent: boolean
        if (registered) {
          sent = await sendMail(email, '[덕친소] 이미 가입된 이메일이에요', '이 이메일로 이미 가입한 계정이 있어요. 덕친소 로그인 화면의 아이디/비밀번호 찾기를 이용해 주세요.\n\n직접 요청하지 않았다면 이 메일은 무시해 주세요.')
        } else {
          const code = emailCode()
          const { error: saveErr } = await db.from('email_codes').upsert({
            email_hmac: emailHmac, code_hmac: await blindIndex('email_code', `${email}:${code}`),
            expires_at: new Date(Date.now() + CODE_TTL_SEC * 1000).toISOString(), tries: 0,
          })
          if (saveErr) throw saveErr
          sent = await sendMail(email, '[덕친소] 이메일 인증 코드', `인증 코드: ${code}\n\n5분 안에 가입 화면에 입력해 주세요.\n직접 요청하지 않았다면 이 메일은 무시해 주세요.`)
        }
        if (!sent) return json({ error: 'mail_not_ready' }, 503)
        return json({ expiresIn: CODE_TTL_SEC })
      }

      // 가입 3단계: 코드 확인 → 인증 완료 표(30분). 코드는 한 번만 쓴다
      case 'email_verify': {
        const email = String(body.email ?? '').trim().toLowerCase()
        const code = String(body.code ?? '').trim().toUpperCase()
        const emailHmac = await blindIndex('email', email)
        const { data: row } = await db.from('email_codes').select('code_hmac, expires_at, tries').eq('email_hmac', emailHmac).maybeSingle()
        if (!row || new Date(row.expires_at) <= new Date() || row.tries >= LIMIT.codeTries) return json({ error: 'email_code_expired' }, 400)
        if (row.code_hmac !== await blindIndex('email_code', `${email}:${code}`)) {
          await db.from('email_codes').update({ tries: row.tries + 1 }).eq('email_hmac', emailHmac)
          return json({ error: 'email_code_invalid' }, 400)
        }
        await db.from('email_codes').delete().eq('email_hmac', emailHmac)
        return json({ ticket: await signState({ purpose: 'signup', email }, 1800) })
      }

      // 가입 4단계: 인증 완료 표 + 아이디 + 비밀번호 → 계정 생성 후 바로 로그인 토큰
      case 'signup': {
        const t = await verifyState(String(body.ticket ?? ''))
        if (t?.purpose !== 'signup' || typeof t.email !== 'string') return json({ error: 'email_ticket_expired' }, 400)
        const pw = String(body.password ?? '')
        const id = String(body.loginId ?? '').trim().toLowerCase()
        if (!LOGIN_ID.test(id)) return json({ error: 'login_id_format' }, 400)
        if (pw.length < 8 || pw.length > 72 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return json({ error: 'bad_request' }, 400)
        const idHmac = await blindIndex('login', id)
        const { data: holder } = await db.from('login_ids').select('user_id').eq('id_hmac', idHmac).maybeSingle()
        if (holder) return json({ error: 'login_id_taken' }, 409)

        const { data, error } = await db.auth.admin.createUser({ email: t.email, password: pw, email_confirm: true })
        if (error) return json({ error: error.code === 'email_exists' || /already/i.test(error.message) ? 'email_taken' : 'bad_request' }, 409)
        const uid = data.user.id
        const { error: saveErr } = await db.from('login_ids').insert({ user_id: uid, id_hmac: idHmac, id_enc: await encrypt(uid, 'login_id', id) })
        if (saveErr) { // 아이디를 저장하지 못하면 로그인할 방법이 없는 계정이 되므로 지운다
          await db.auth.admin.deleteUser(uid)
          if (saveErr.code === '23505') return json({ error: 'login_id_taken' }, 409)
          throw saveErr
        }
        return json({ tokenHash: await magicLink(db, uid) })
      }

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

      // 아이디 만들기: 아이디 없이 가입한 예전 이메일 계정만, 한 번만
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

      // 비밀번호 찾기 1단계: 아이디 + 가입 이메일이 같은 계정일 때만 그 이메일로 인증 코드(5분)를 보낸다.
      // 맞든 틀리든 화면에는 같은 답을 준다(계정·이메일 짝 맞추기 방지). 아이디별·IP별 10분 횟수 제한
      case 'reset_code': {
        const id = String(body.loginId ?? '').trim().toLowerCase()
        const email = String(body.email ?? '').trim().toLowerCase()
        if (!LOGIN_ID.test(id) || !EMAIL.test(email) || email.length > 254) return json({ error: 'bad_request' }, 400)
        if (!canMail(email)) return json({ error: 'mail_not_ready' }, 503)
        if (!(await verifyCaptcha(body.captchaToken, clientIp(req)))) return json({ error: 'captcha_failed' }, 400)
        const idHmac = await blindIndex('login', id)
        const mailKey = `mail:${await blindIndex('email', email)}`
        const keys = [`reset:${idHmac}`, `resetip:${await blindIndex('ip', clientIp(req))}`]
        const [byId, byIp] = await Promise.all(keys.map((k) => recent(db, k)))
        if (byId >= LIMIT.codeEmail || byIp >= LIMIT.codeIp || await mailFlood(db, mailKey)) return json({ error: 'too_many_attempts' }, 429)
        await db.from('login_attempts').insert([...keys, mailKey].map((key) => ({ key })))
        const uid = await resetTarget(db, idHmac, email)
        if (uid) {
          const code = emailCode()
          const { error: saveErr } = await db.from('email_codes').upsert({
            email_hmac: await blindIndex('reset', uid), code_hmac: await blindIndex('reset_code', `${uid}:${code}`),
            expires_at: new Date(Date.now() + CODE_TTL_SEC * 1000).toISOString(), tries: 0,
          })
          if (saveErr) throw saveErr
          await sendMail(email, '[덕친소] 비밀번호 재설정 인증 코드',
            `인증 코드: ${code}\n\n5분 안에 비밀번호 찾기 화면에 입력해 주세요.\n직접 요청하지 않았다면 이 메일은 무시해 주세요. 코드를 모르면 비밀번호는 바뀌지 않아요.`)
        }
        return json({ expiresIn: CODE_TTL_SEC })
      }

      // 비밀번호 찾기 2단계: 아이디 + 이메일 + 코드 + 새 비밀번호. 코드는 한 번만, 5번 틀리면 무효.
      // 바꾸면 모든 기기의 로그인을 끊고, 가입 메일로 변경 알림을 보낸다
      case 'reset_verify': {
        const id = String(body.loginId ?? '').trim().toLowerCase()
        const email = String(body.email ?? '').trim().toLowerCase()
        const code = String(body.code ?? '').trim().toUpperCase()
        const ticket = body.ticket ? await verifyState(String(body.ticket)) : null // 아이디 찾기에서 이메일 코드를 이미 확인한 경우(30분)
        const pw = String(body.password ?? '')
        if (!LOGIN_ID.test(id) || !EMAIL.test(email) || (!code && !body.ticket)) return json({ error: 'bad_request' }, 400)
        if (pw.length < 8 || pw.length > 72 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return json({ error: 'password_rule' }, 400)
        const idHmac = await blindIndex('login', id)
        const keys = [`resetv:${idHmac}`, `resetvip:${await blindIndex('ip', clientIp(req))}`]
        const [byId, byIp] = await Promise.all(keys.map((k) => recent(db, k)))
        if (byId >= LIMIT.id || byIp >= LIMIT.ip) return json({ error: 'too_many_attempts' }, 429)
        await db.from('login_attempts').insert(keys.map((key) => ({ key })))
        const uid = await resetTarget(db, idHmac, email)
        if (body.ticket) {
          // 표는 같은 계정(아이디·이메일 일치)일 때만 유효. 코드 확인을 대신한다
          if (!uid || ticket?.purpose !== 'reset' || ticket.uid !== uid) return json({ error: 'email_ticket_expired' }, 400)
        } else {
          const codeKey = uid ? await blindIndex('reset', uid) : null
          const { data: row } = codeKey
            ? await db.from('email_codes').select('code_hmac, expires_at, tries').eq('email_hmac', codeKey).maybeSingle()
            : { data: null }
          if (!uid || !row || new Date(row.expires_at) <= new Date() || row.tries >= LIMIT.codeTries) return json({ error: 'email_code_expired' }, 400)
          if (row.code_hmac !== await blindIndex('reset_code', `${uid}:${code}`)) {
            await db.from('email_codes').update({ tries: row.tries + 1 }).eq('email_hmac', codeKey)
            return json({ error: 'email_code_invalid' }, 400)
          }
          await db.from('email_codes').delete().eq('email_hmac', codeKey)
        }
        const { error } = await db.auth.admin.updateUserById(uid, { password: pw })
        if (error) throw error
        const { error: revokeErr } = await db.rpc('revoke_user_sessions', { p_uid: uid })
        if (revokeErr) throw revokeErr
        await sendMail(email, '[덕친소] 비밀번호가 바뀌었어요',
          '덕친소 계정의 비밀번호가 방금 바뀌었고, 모든 기기에서 로그아웃됐어요.\n\n본인이 바꾼 게 아니라면 바로 비밀번호 찾기로 다시 바꾸고 문의해 주세요.')
        return json({ ok: true })
      }

      // 아이디 찾기 1단계: 캡차 + 가입 이메일 → 아이디가 있는 계정이면 인증 코드만 메일로 (메일에 아이디를 넣지 않는다).
      // 아이디 없는 계정은 로그인 방법 안내, 가입 안 된 이메일은 아무것도 보내지 않는다. 화면 응답은 모두 같다.
      // 제한: IP 10분 5회 + 이메일 1시간 3회·하루 5회 (메일 폭탄 방지)
      case 'find_code': {
        const email = String(body.email ?? '').trim()
        if (!EMAIL.test(email) || email.length > 254) return json({ error: 'bad_request' }, 400)
        if (!canMail(email)) return json({ ok: true, mailReady: false })
        if (!(await verifyCaptcha(body.captchaToken, clientIp(req)))) return json({ error: 'captcha_failed' }, 400)
        const key = `find:${await blindIndex('ip', clientIp(req))}`
        const mailKey = `mail:${await blindIndex('email', email.toLowerCase())}`
        if (await recent(db, key) >= LIMIT.find || await mailFlood(db, mailKey)) return json({ error: 'too_many_attempts' }, 429)
        await db.from('login_attempts').insert([{ key }, { key: mailKey }])
        const { data } = await db.rpc('login_id_by_email', { p_email: email })
        const row = data?.[0]
        if (row) {
          const code = emailCode()
          const { error: saveErr } = await db.from('email_codes').upsert({
            email_hmac: await blindIndex('find', row.user_id), code_hmac: await blindIndex('find_code', `${row.user_id}:${code}`),
            expires_at: new Date(Date.now() + CODE_TTL_SEC * 1000).toISOString(), tries: 0,
          })
          if (saveErr) throw saveErr
          await sendMail(email, '[덕친소] 아이디 찾기 인증 코드',
            `인증 코드: ${code}\n\n5분 안에 아이디 찾기 화면에 입력하면 아이디가 화면에 나타나요.\n직접 요청하지 않았다면 이 메일은 무시해 주세요.`)
        } else if ((await db.rpc('email_registered', { p_email: email })).data) {
          // 가입은 됐지만 아이디가 없는 계정(구글 등 간편 로그인, 아이디 만들기 전 이메일 가입). 전에는 아무 메일도 안 가서 "안 온다"로 보였다
          await sendMail(email, '[덕친소] 이 이메일로 가입한 계정에는 아이디가 없어요',
            '이 이메일로 가입한 덕친소 계정은 아이디 없이 만들어졌어요.\n\n'
            + '- Google·카카오·네이버·Apple 로 가입했다면: 로그인 화면에서 그 버튼으로 로그인해 주세요.\n'
            + '- 이메일로 가입했다면: 회원 로그인 화면의 아이디 칸에 이 이메일 주소를 넣고 로그인한 뒤 아이디를 만들 수 있어요.\n\n'
            + '직접 요청하지 않았다면 이 메일은 무시해 주세요.')
        }
        return json({ ok: true, mailReady: true, expiresIn: CODE_TTL_SEC })
      }

      // 아이디 찾기 2단계: 이메일 + 코드 → 아이디를 화면에만 돌려준다(저장·메일 없음).
      // 함께 30분짜리 표를 줘서 바로 비밀번호를 바꿀 때 코드를 다시 받지 않게 한다
      case 'find_verify': {
        const email = String(body.email ?? '').trim()
        const code = String(body.code ?? '').trim().toUpperCase()
        if (!EMAIL.test(email) || !code) return json({ error: 'bad_request' }, 400)
        const key = `findv:${await blindIndex('ip', clientIp(req))}`
        if (await recent(db, key) >= LIMIT.ip) return json({ error: 'too_many_attempts' }, 429)
        await db.from('login_attempts').insert({ key })
        const { data } = await db.rpc('login_id_by_email', { p_email: email })
        const row = data?.[0]
        const codeKey = row ? await blindIndex('find', row.user_id) : null
        const { data: c } = codeKey
          ? await db.from('email_codes').select('code_hmac, expires_at, tries').eq('email_hmac', codeKey).maybeSingle()
          : { data: null }
        if (!row || !c || new Date(c.expires_at) <= new Date() || c.tries >= LIMIT.codeTries) return json({ error: 'email_code_expired' }, 400)
        if (c.code_hmac !== await blindIndex('find_code', `${row.user_id}:${code}`)) {
          await db.from('email_codes').update({ tries: c.tries + 1 }).eq('email_hmac', codeKey)
          return json({ error: 'email_code_invalid' }, 400)
        }
        await db.from('email_codes').delete().eq('email_hmac', codeKey)
        return json({
          loginId: await decrypt(row.user_id, 'login_id', row.id_enc),
          ticket: await signState({ purpose: 'reset', uid: row.user_id }, 1800),
        })
      }
    }
    return json({ error: 'bad_request' }, 400)
  } catch (e) {
    console.error('login_id_failed', body.action, (e as Error).message) // 아이디·비밀번호는 남기지 않는다
    return json({ error: 'server_error' }, 500)
  }
})
