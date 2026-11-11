import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, errorText } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { TextTabs } from '@/components/ui/TextTabs'
import { toast } from '@/store/ui'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const LOGIN_ID = /^[a-z][a-z0-9_]{3,19}$/
const pwOk = (p: string) => p.length >= 8 && p.length <= 72 && /[A-Za-z]/.test(p) && /\d/.test(p)

// 아이디 찾기: 가입한 이메일로 아이디 발송
// 비밀번호 찾기: 아이디 + 가입 이메일 → (둘이 같은 계정일 때만) 메일 인증 코드 → 코드 + 새 비밀번호.
//   바꾸면 모든 기기에서 로그아웃되고 변경 알림 메일이 간다(login-id 함수). 가입 여부·짝 일치 여부는 화면에 알리지 않는다
export default function FindAccount() {
  const [tab, setTab] = useState<'id' | 'pw'>('id')
  return (
    <div className="flex min-h-full flex-col">
      <AppHeader back title="아이디·비밀번호 찾기" />
      <TextTabs label="찾을 항목" value={tab} onChange={setTab}
        tabs={[{ value: 'id', label: '아이디 찾기' }, { value: 'pw', label: '비밀번호 찾기' }]} />
      {tab === 'id' ? <FindId /> : <ResetPassword />}
    </div>
  )
}

const FORM = 'flex flex-1 flex-col px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-4'

function FindId() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const ok = EMAIL.test(email)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ok || busy) return
    setBusy(true)
    try {
      const r = await api.findLoginId(email)
      if (!r.mailReady) return toast('아이디 찾기 메일은 아직 준비 중이에요. 문의하기로 연락해 주세요.')
      setDone(true)
    } catch (err) { toast(errorText(err)) } finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} className={FORM}>
      <p className="t-body text-graphite">이메일로 가입할 때 쓴 주소를 넣어 주세요. 네이버·카카오·구글·Apple로 가입했다면 그 버튼으로 로그인하면 돼요.</p>
      <TextField className="mt-6" label="가입한 이메일" type="email" autoComplete="email" inputMode="email" value={email}
        onChange={(e) => { setEmail(e.target.value.trim()); setDone(false) }}
        error={email && !ok ? '이메일 형식을 확인해 주세요.' : undefined} />
      {done && <p role="status" className="mt-3 t-sub text-graphite">가입된 이메일이면 아이디(또는 로그인 방법)를 메일로 보냈어요. 몇 분 안에 안 오면 스팸함도 확인해 주세요.</p>}
      <Button type="submit" block className="mt-auto" disabled={!ok || busy}>{busy ? '보내는 중…' : '아이디 메일 받기'}</Button>
    </form>
  )
}

function ResetPassword() {
  const nav = useNavigate()
  const [step, setStep] = useState<'request' | 'verify' | 'done'>('request')
  const [loginId, setLoginId] = useState('')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const run = async (f: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    try { await f() } catch (err) { toast(errorText(err)) } finally { setBusy(false) }
  }

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
      <form className={FORM} onSubmit={(e) => { e.preventDefault(); if (ok) run(async () => { await api.requestPasswordReset(loginId, email); setStep('verify') }) }}>
        <p className="t-body text-graphite">아이디와 가입한 이메일을 넣어 주세요. 둘이 같은 계정이면 그 이메일로 인증 코드를 보내요.</p>
        <TextField className="mt-6" label="아이디" autoComplete="username" autoCapitalize="none" spellCheck={false} value={loginId}
          onChange={(e) => setLoginId(e.target.value.trim().toLowerCase())}
          error={loginId && !LOGIN_ID.test(loginId) ? '아이디 형식을 확인해 주세요.' : undefined} />
        <TextField className="mt-5" label="가입한 이메일" type="email" autoComplete="email" inputMode="email" value={email}
          onChange={(e) => setEmail(e.target.value.trim())}
          error={email && !EMAIL.test(email) ? '이메일 형식을 확인해 주세요.' : undefined} />
        <Button type="submit" block className="mt-auto" disabled={!ok || busy}>{busy ? '보내는 중…' : '인증 코드 받기'}</Button>
      </form>
    )
  }

  const ok = code.trim().length === 6 && pwOk(pw) && pw === pw2
  return (
    <form className={FORM} onSubmit={(e) => { e.preventDefault(); if (ok) run(async () => { await api.resetPasswordWithCode(loginId, email, code, pw); setStep('done') }) }}>
      <p className="t-body text-graphite">아이디와 이메일이 맞으면 <b className="text-ink">{email}</b> 로 6자리 인증 코드를 보냈어요. 5분 안에 넣어 주세요.</p>
      <TextField className="mt-6" label="인증 코드" autoComplete="one-time-code" autoCapitalize="characters" maxLength={6} value={code}
        onChange={(e) => setCode(e.target.value.trim().toUpperCase())} />
      <TextField className="mt-5" label="새 비밀번호" type="password" autoComplete="new-password" value={pw}
        onChange={(e) => setPw(e.target.value)} hint="영문과 숫자를 섞어 8자 이상"
        error={pw && !pwOk(pw) ? '영문과 숫자를 섞어 8~72자로 정해 주세요.' : undefined} />
      <TextField className="mt-5" label="새 비밀번호 확인" type="password" autoComplete="new-password" value={pw2}
        onChange={(e) => setPw2(e.target.value)} error={pw2 && pw !== pw2 ? '비밀번호가 서로 달라요.' : undefined} />
      <button type="button" disabled={busy} onClick={() => run(async () => { await api.requestPasswordReset(loginId, email); toast('인증 코드를 다시 보냈어요') })}
        className="mt-3 h-10 self-start t-sub font-semibold text-graphite">코드 다시 받기</button>
      <Button type="submit" block className="mt-auto" disabled={!ok || busy}>{busy ? '바꾸는 중…' : '비밀번호 바꾸기'}</Button>
    </form>
  )
}
