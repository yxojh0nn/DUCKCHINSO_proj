import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, errorText } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { ConsentList, allRequired } from '@/components/ConsentList'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { toast, useUI } from '@/store/ui'

// 이메일 가입. 개인정보 수집·이용 동의서를 함께 받는다
// 메일 인증 → 아이디 만들기(Gate 가 보냄) → 이후 로그인은 아이디 + 비밀번호 (이메일은 아이디로 쓰지 않는다)
export default function EmailAuth() {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [consents, setConsents] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState<string | null>(null)
  const setPending = useUI((s) => s.setPendingConsents)
  const nav = useNavigate()

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const pwOk = pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw)
  const canSubmit = emailOk && pwOk && allRequired(consents)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit || busy) return
    setBusy(true)
    try {
      // 동의 기록은 계정이 생긴 직후(첫 로그인) DB에 저장된다
      setPending(consents)
      const r = await api.signUpEmail(email, pw)
      if (r.needsConfirm) setSent(`${email}로 인증 메일을 보냈어요. 메일의 링크를 누르면 아이디를 만들고 가입이 끝나요.`)
      else nav('/calendar', { replace: true })
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
          <Button className="mt-8" block variant="secondary" onClick={() => nav('/login/member', { replace: true })}>로그인 화면으로</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader back title="이메일로 가입" />
      <form onSubmit={submit} className="flex flex-1 flex-col px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-4">
        <TextField label="이메일" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value.trim())}
          hint="인증 메일과 아이디·비밀번호 찾기에만 써요. 로그인 아이디는 인증 뒤에 따로 만들어요."
          error={email && !emailOk ? '이메일 형식을 확인해 주세요.' : undefined} />
        <TextField className="mt-5" label="비밀번호" type="password" autoComplete="new-password"
          value={pw} onChange={(e) => setPw(e.target.value)} hint="영문과 숫자를 섞어 8자 이상"
          error={pw && !pwOk ? '영문과 숫자를 섞어 8자 이상으로 만들어 주세요.' : undefined} />
        <div className="mt-8">
          <p className="mb-1 t-sub font-semibold text-graphite">약관 동의</p>
          <ConsentList value={consents} onChange={setConsents} />
        </div>
        <Button type="submit" block className="mt-auto" disabled={!canSubmit || busy}>
          {busy ? '처리 중…' : '동의하고 가입하기'}
        </Button>
      </form>
    </div>
  )
}
