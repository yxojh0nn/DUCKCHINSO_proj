import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, errorText, LOGIN_ID } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { ConsentList, allRequired } from '@/components/ConsentList'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Confirm'
import { TextField } from '@/components/ui/Field'
import { toast, useUI } from '@/store/ui'

const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`

// 이메일 가입. 아이디(로그인 수단) 중복 확인 → 이메일(인증 수단) 코드 인증 → 비밀번호·약관 → 가입
// 앞 단계를 마쳐야 다음 단계가 열린다
export default function EmailAuth() {
  const nav = useNavigate()
  const setPending = useUI((s) => s.setPendingConsents)
  const [popup, setPopup] = useState<{ title: string; tone: 'danger' | 'success' } | null>(null)
  const [busy, setBusy] = useState<'id' | 'send' | 'code' | 'submit' | null>(null)

  const [loginId, setLoginId] = useState('')
  const [idState, setIdState] = useState<'idle' | 'taken' | 'ok'>('idle')

  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [expiresAt, setExpiresAt] = useState<number | null>(null) // 코드를 보낸 뒤에만 값이 있다
  const [left, setLeft] = useState(0)
  const [ticket, setTicket] = useState<string | null>(null) // 인증 완료 표

  const [pw, setPw] = useState('')
  const [consents, setConsents] = useState<Record<string, boolean>>({})

  const idFormat = LOGIN_ID.test(loginId)
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const pwOk = pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw)
  const canSubmit = idState === 'ok' && !!ticket && pwOk && allRequired(consents)

  useEffect(() => {
    if (!expiresAt || ticket) return
    const tick = () => setLeft(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [expiresAt, ticket])

  const resetEmail = () => { setTicket(null); setExpiresAt(null); setCode('') }

  const run = async (what: NonNullable<typeof busy>, f: () => Promise<void>) => {
    if (busy) return
    setBusy(what)
    try { await f() } catch (e) { toast(errorText(e)) } finally { setBusy(null) }
  }

  const checkId = () => run('id', async () => {
    const free = await api.checkLoginId(loginId)
    setIdState(free ? 'ok' : 'taken')
    if (!free) setPopup({ title: '이미 사용된 아이디입니다.', tone: 'danger' })
  })
  const sendCode = () => run('send', async () => {
    const { expiresIn } = await api.sendEmailCode(email)
    setCode('')
    setExpiresAt(Date.now() + expiresIn * 1000)
    toast('인증 메일을 보냈어요.')
  })
  const verifyCode = () => run('code', async () => {
    setTicket(await api.verifyEmailCode(email, code))
    setPopup({ title: '메일 인증이 완료되었습니다.', tone: 'success' })
  })
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    run('submit', async () => {
      setPending(consents) // 동의 기록은 계정이 생긴 직후 Gate 가 저장한다
      try {
        await api.signUpEmail(ticket!, loginId, pw)
      } catch (err) {
        setPending(null)
        const m = (err as Error).message
        if (m.includes('login_id_taken')) setIdState('taken')
        if (m.includes('email_ticket_expired')) resetEmail()
        throw err
      }
      nav('/calendar', { replace: true })
    })
  }

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader back title="이메일로 가입" />
      <form onSubmit={submit} className="flex flex-1 flex-col px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-4">
        <TextField label="아이디" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={20}
          value={loginId} onChange={(e) => { setLoginId(e.target.value.trim().toLowerCase()); setIdState('idle') }}
          hint="로그인할 때 써요. 나만 볼 수 있어요. 영문 소문자로 시작, 영문 소문자·숫자·밑줄(_) 4~20자"
          error={idState === 'taken' ? '이미 사용된 아이디입니다.' : loginId && !idFormat ? '영문 소문자로 시작하고, 영문 소문자·숫자·밑줄로 4~20자여야 해요.' : undefined}
          success={idState === 'ok' ? '사용 가능한 아이디입니다.' : undefined}
          action={<Button variant="secondary" size="md" className="shrink-0" disabled={!idFormat || idState === 'ok' || !!busy} onClick={checkId}>{busy === 'id' ? '확인 중…' : '중복 확인'}</Button>} />

        {idState === 'ok' && (
          <>
            <TextField className="mt-6" label="이메일" type="email" autoComplete="email" inputMode="email" value={email} readOnly={!!ticket}
              onChange={(e) => { setEmail(e.target.value.trim()); resetEmail() }}
              hint="본인 인증과 아이디·비밀번호 찾기에만 써요."
              error={email && !emailOk ? '이메일 형식을 확인해 주세요.' : undefined}
              success={ticket ? '인증이 완료되었습니다.' : undefined}
              action={ticket
                ? <Button variant="secondary" size="md" className="shrink-0" disabled={!!busy} onClick={resetEmail}>변경</Button>
                : !expiresAt && <Button variant="secondary" size="md" className="shrink-0" disabled={!emailOk || !!busy} onClick={sendCode}>{busy === 'send' ? '보내는 중…' : '인증'}</Button>} />

            {expiresAt && !ticket && (
              <div className="mt-5">
                <TextField label="인증 코드" autoComplete="one-time-code" autoCapitalize="characters" spellCheck={false} maxLength={6}
                  value={code} onChange={(e) => setCode(e.target.value.trim().toUpperCase())}
                  error={left === 0 ? '시간이 지났어요. 인증 메일을 다시 받아 주세요.' : undefined}
                  hint={`메일로 받은 6자리 코드를 넣어 주세요. 남은 시간 ${clock(left)}`}
                  action={<Button variant="secondary" size="md" className="shrink-0" disabled={code.length !== 6 || left === 0 || !!busy} onClick={verifyCode}>{busy === 'code' ? '확인 중…' : '확인'}</Button>} />
                <button type="button" onClick={sendCode} disabled={!!busy} className="mt-1 flex h-11 items-center t-sub text-graphite underline underline-offset-4 disabled:opacity-50">
                  {busy === 'send' ? '보내는 중…' : '인증 메일 다시 보내기'}
                </button>
                {api.mode === 'demo' && <p className="t-cap text-graphite">데모 모드: 인증 코드는 DEMO12 예요.</p>}
              </div>
            )}
          </>
        )}

        {idState === 'ok' && ticket && (
          <>
            <TextField className="mt-6" label="비밀번호" type="password" autoComplete="new-password"
              value={pw} onChange={(e) => setPw(e.target.value)} hint="영문과 숫자를 섞어 8자 이상"
              error={pw && !pwOk ? '영문과 숫자를 섞어 8자 이상으로 만들어 주세요.' : undefined} />
            <div className="mt-8">
              <p className="mb-1 t-sub font-semibold text-graphite">약관 동의</p>
              <ConsentList value={consents} onChange={setConsents} />
            </div>
          </>
        )}

        <Button type="submit" block className="mt-auto" disabled={!canSubmit || !!busy}>
          {busy === 'submit' ? '가입하는 중…' : '동의하고 가입하기'}
        </Button>
      </form>
      <Alert open={!!popup} title={popup?.title ?? ''} tone={popup?.tone ?? 'success'} onClose={() => setPopup(null)} />
    </div>
  )
}
