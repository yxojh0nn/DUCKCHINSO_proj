import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, errorText } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { ConsentList, allRequired } from '@/components/ConsentList'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { TextTabs } from '@/components/ui/TextTabs'
import { toast, useUI } from '@/store/ui'

// 이메일 가입·로그인. 가입 시 개인정보 수집·이용 동의서를 함께 받는다
export default function EmailAuth() {
  const [tab, setTab] = useState<'signup' | 'login'>('signup')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [consents, setConsents] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState<string | null>(null)
  const setPending = useUI((s) => s.setPendingConsents)
  const nav = useNavigate()

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const pwOk = pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw)
  const canSubmit = emailOk && (tab === 'login' ? pw.length > 0 : pwOk && allRequired(consents))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit || busy) return
    setBusy(true)
    try {
      if (tab === 'signup') {
        // 동의 기록은 계정이 생긴 직후(첫 로그인) DB에 저장된다
        setPending(consents)
        const r = await api.signUpEmail(email, pw)
        if (r.needsConfirm) setSent(`${email}로 인증 메일을 보냈어요. 메일의 링크를 누르면 가입이 끝나요.`)
        else nav('/calendar', { replace: true })
      } else {
        await api.signInEmail(email, pw)
        nav('/calendar', { replace: true })
      }
    } catch (err) {
      toast(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <div className="flex h-full flex-col">
        <AppHeader back />
        <div className="px-6 pt-6">
          <h1 className="t-title">메일을 확인해 주세요</h1>
          <p className="mt-2 t-body text-graphite">{sent}</p>
          <Button className="mt-8" block variant="secondary" onClick={() => { setSent(null); setTab('login') }}>로그인 화면으로</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader back title="이메일" />
      <TextTabs label="가입 또는 로그인" value={tab} onChange={setTab} tabs={[{ value: 'signup', label: '가입하기' }, { value: 'login', label: '로그인' }]} />
      <form onSubmit={submit} className="flex flex-1 flex-col px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-4">
        <TextField label="이메일" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value.trim())}
          error={email && !emailOk ? '이메일 형식을 확인해 주세요.' : undefined} />
        <TextField className="mt-5" label="비밀번호" type="password" autoComplete={tab === 'signup' ? 'new-password' : 'current-password'}
          value={pw} onChange={(e) => setPw(e.target.value)}
          hint={tab === 'signup' ? '영문과 숫자를 섞어 8자 이상' : undefined}
          error={tab === 'signup' && pw && !pwOk ? '영문과 숫자를 섞어 8자 이상으로 만들어 주세요.' : undefined} />
        {tab === 'login' && (
          <button type="button" className="mt-3 self-start t-sub text-graphite underline underline-offset-4"
            onClick={async () => {
              if (!emailOk) return toast('이메일을 먼저 입력해 주세요.')
              await api.resetPassword(email)
              toast('비밀번호 재설정 메일을 보냈어요.')
            }}>비밀번호를 잊었어요</button>
        )}
        {tab === 'signup' && (
          <div className="mt-8">
            <p className="mb-1 t-sub font-semibold text-graphite">약관 동의</p>
            <ConsentList value={consents} onChange={setConsents} />
          </div>
        )}
        <Button type="submit" block className="mt-auto" disabled={!canSubmit || busy}>
          {busy ? '처리 중…' : tab === 'signup' ? '동의하고 가입하기' : '로그인'}
        </Button>
      </form>
    </div>
  )
}
