import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { Captcha, captchaOn } from '@/components/Captcha'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { TextTabs } from '@/components/ui/TextTabs'
import { toast } from '@/store/ui'
import { useRun } from '@/lib/actions'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const LOGIN_ID = /^[a-z][a-z0-9_]{3,19}$/
const pwOk = (p: string) => p.length >= 8 && p.length <= 72 && /[A-Za-z]/.test(p) && /\d/.test(p)
const FORM = 'flex flex-1 flex-col px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-4'

// 비밀번호 찾기로 넘길 때: 아이디 찾기에서 이미 이메일 코드를 확인했으면 ticket 으로 코드 단계를 건너뛴다
type ResetStart = { loginId: string; email: string; ticket: string }

// 아이디 찾기: 캡차 + 이메일 → 인증 코드 메일 → 코드가 맞으면 아이디를 화면에만 (메일에 아이디를 넣지 않는다)
// 비밀번호 찾기: 캡차 + 아이디 + 이메일 → (같은 계정일 때만) 인증 코드 → 코드 + 새 비밀번호. 바꾸면 모든 기기 로그아웃
// 가입 여부·아이디/이메일 일치 여부는 화면에 알리지 않는다 (login-id 함수, docs/아이디_비밀번호_찾기_설계.md)
export default function FindAccount() {
  const [tab, setTab] = useState<'id' | 'pw'>('id')
  const [resetStart, setResetStart] = useState<ResetStart | null>(null)
  return (
    <div className="flex min-h-full flex-col">
      <AppHeader back title="아이디·비밀번호 찾기" />
      <TextTabs label="찾을 항목" value={tab} onChange={(t) => { setTab(t); setResetStart(null) }}
        tabs={[{ value: 'id', label: '아이디 찾기' }, { value: 'pw', label: '비밀번호 찾기' }]} />
      {tab === 'id'
        ? <FindId onReset={(s) => { setResetStart(s); setTab('pw') }} />
        : <ResetPassword key={resetStart?.ticket ?? 'new'} start={resetStart} />}
    </div>
  )
}

// 캡차 토큰은 한 번만 쓸 수 있다 → 쓸 때마다 위젯을 다시 그린다
function useCaptcha() {
  const [token, setToken] = useState<string | null>(null)
  const [round, setRound] = useState(0)
  return {
    token: token ?? undefined,
    ready: !captchaOn || !!token,
    reset: () => { setToken(null); setRound((n) => n + 1) },
    widget: <Captcha key={round} onToken={setToken} />,
  }
}

function FindId({ onReset }: { onReset: (s: ResetStart) => void }) {
  const nav = useNavigate()
  const captcha = useCaptcha()
  const { busy, run } = useRun()
  const [step, setStep] = useState<'email' | 'code' | 'shown'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [found, setFound] = useState<{ loginId: string; ticket: string } | null>(null)
  const sendCode = () => run(async () => {
    const r = await api.findLoginIdCode(email, captcha.token)
    captcha.reset()
    if (!r.mailReady) return toast('아이디 찾기 메일은 아직 준비 중이에요. 문의하기로 연락해 주세요.')
    setStep('code')
  }, captcha.reset)

  if (step === 'shown' && found) return (
    <div className={FORM}>
      <p className="t-body text-graphite">가입하신 아이디예요.</p>
      <p className="mt-3 rounded-[12px] bg-mist px-4 py-4 text-center t-title">{found.loginId}</p>
      <div className="mt-auto flex flex-col gap-2.5">
        <Button block onClick={() => nav('/login/member', { replace: true })}>이 아이디로 로그인</Button>
        <Button block variant="secondary" onClick={() => onReset({ loginId: found.loginId, email, ticket: found.ticket })}>비밀번호도 바꾸기</Button>
      </div>
    </div>
  )

  if (step === 'code') return (
    <form className={FORM} onSubmit={(e) => {
      e.preventDefault()
      if (code.length === 6) run(async () => { setFound(await api.findLoginIdVerify(email, code)); setStep('shown') })
    }}>
      <p className="t-body text-graphite"><b className="text-ink">{email}</b> 로 가입한 아이디가 있으면 6자리 인증 코드를 보냈어요. 5분 안에 넣어 주세요. 간편 로그인으로 가입했다면 로그인 방법을 메일로 보냈어요.</p>
      <TextField className="mt-6" label="인증 코드" autoComplete="one-time-code" autoCapitalize="characters" maxLength={6} value={code}
        onChange={(e) => setCode(e.target.value.trim().toUpperCase())} />
      <p className="mt-3 t-sub text-graphite">몇 분 안에 안 오면 스팸함도 확인해 주세요.</p>
      <Button type="submit" block className="mt-auto" disabled={code.length !== 6 || busy}>{busy ? '확인 중…' : '아이디 확인'}</Button>
    </form>
  )

  const ok = EMAIL.test(email)
  return (
    <form className={FORM} onSubmit={(e) => { e.preventDefault(); if (ok && captcha.ready) sendCode() }}>
      <p className="t-body text-graphite">이메일로 가입할 때 쓴 주소를 넣어 주세요. 인증 코드를 확인하면 아이디를 이 화면에 보여 드려요. 네이버·카카오·구글·Apple로 가입했다면 그 버튼으로 로그인하면 돼요.</p>
      <TextField className="mt-6" label="가입한 이메일" type="email" autoComplete="email" inputMode="email" value={email}
        onChange={(e) => setEmail(e.target.value.trim())}
        error={email && !ok ? '이메일 형식을 확인해 주세요.' : undefined} />
      {captcha.widget}
      <Button type="submit" block className="mt-auto" disabled={!ok || !captcha.ready || busy}>{busy ? '보내는 중…' : '인증 코드 받기'}</Button>
    </form>
  )
}

function ResetPassword({ start }: { start: ResetStart | null }) {
  const nav = useNavigate()
  const captcha = useCaptcha()
  const { busy, run } = useRun()
  const [step, setStep] = useState<'request' | 'verify' | 'done'>(start ? 'verify' : 'request')
  const [loginId, setLoginId] = useState(start?.loginId ?? '')
  const [email, setEmail] = useState(start?.email ?? '')
  const [code, setCode] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const ticket = start?.ticket
  const sendCode = (then: () => void) => run(async () => {
    await api.requestPasswordReset(loginId, email, captcha.token)
    captcha.reset()
    then()
  }, captcha.reset)

  if (step === 'done') return (
    <div className={FORM}>
      <p className="t-title">비밀번호를 바꿨어요</p>
      <p className="mt-2 t-body text-graphite">모든 기기에서 로그아웃됐어요. 새 비밀번호로 다시 로그인해 주세요.</p>
      <Button block className="mt-auto" onClick={() => nav('/login/member', { replace: true })}>로그인하러 가기</Button>
    </div>
  )

  if (step === 'request') {
    const ok = LOGIN_ID.test(loginId) && EMAIL.test(email)
    return (
      <form className={FORM} onSubmit={(e) => { e.preventDefault(); if (ok && captcha.ready) sendCode(() => setStep('verify')) }}>
        <p className="t-body text-graphite">아이디와 가입한 이메일을 넣어 주세요. 둘이 같은 계정이면 그 이메일로 인증 코드를 보내요.</p>
        <TextField className="mt-6" label="아이디" autoComplete="username" autoCapitalize="none" spellCheck={false} value={loginId}
          onChange={(e) => setLoginId(e.target.value.trim().toLowerCase())}
          error={loginId && !LOGIN_ID.test(loginId) ? '아이디 형식을 확인해 주세요.' : undefined} />
        <TextField className="mt-5" label="가입한 이메일" type="email" autoComplete="email" inputMode="email" value={email}
          onChange={(e) => setEmail(e.target.value.trim())}
          error={email && !EMAIL.test(email) ? '이메일 형식을 확인해 주세요.' : undefined} />
        {captcha.widget}
        <Button type="submit" block className="mt-auto" disabled={!ok || !captcha.ready || busy}>{busy ? '보내는 중…' : '인증 코드 받기'}</Button>
      </form>
    )
  }

  const ok = (ticket || code.length === 6) && pwOk(pw) && pw === pw2
  return (
    <form className={FORM} onSubmit={(e) => {
      e.preventDefault()
      if (ok) run(async () => { await api.resetPasswordWithCode(loginId, email, ticket ? { ticket } : { code }, pw); setStep('done') })
    }}>
      {ticket
        ? <p className="t-body text-graphite">아이디 <b className="text-ink">{loginId}</b> 의 새 비밀번호를 정해 주세요. 30분 안에 바꿔야 해요.</p>
        : <>
            <p className="t-body text-graphite">아이디와 이메일이 맞으면 <b className="text-ink">{email}</b> 로 6자리 인증 코드를 보냈어요. 5분 안에 넣어 주세요.</p>
            <TextField className="mt-6" label="인증 코드" autoComplete="one-time-code" autoCapitalize="characters" maxLength={6} value={code}
              onChange={(e) => setCode(e.target.value.trim().toUpperCase())} />
          </>}
      <TextField className="mt-5" label="새 비밀번호" type="password" autoComplete="new-password" value={pw}
        onChange={(e) => setPw(e.target.value)} hint="영문과 숫자를 섞어 8자 이상"
        error={pw && !pwOk(pw) ? '영문과 숫자를 섞어 8~72자로 정해 주세요.' : undefined} />
      <TextField className="mt-5" label="새 비밀번호 확인" type="password" autoComplete="new-password" value={pw2}
        onChange={(e) => setPw2(e.target.value)} error={pw2 && pw !== pw2 ? '비밀번호가 서로 달라요.' : undefined} />
      {!ticket && <>
        {captcha.widget}
        <button type="button" disabled={busy || !captcha.ready} onClick={() => sendCode(() => toast('인증 코드를 다시 보냈어요'))}
          className="mt-3 h-10 self-start t-sub font-semibold text-graphite disabled:opacity-40">코드 다시 받기</button>
      </>}
      <Button type="submit" block className="mt-auto" disabled={!ok || busy}>{busy ? '바꾸는 중…' : '비밀번호 바꾸기'}</Button>
    </form>
  )
}
