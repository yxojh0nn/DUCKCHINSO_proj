import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api, errorText, type OAuthProvider } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { TextField } from '@/components/ui/Field'
import { toast } from '@/store/ui'

// 간편 로그인 버튼: 각 서비스의 공식 표기 색을 따른다 (브랜드 가이드)
const PROVIDERS: { id: OAuthProvider; label: string; cls: string; mark: React.ReactNode }[] = [
  { id: 'kakao', label: '카카오로 계속하기', cls: 'bg-[#FEE500] text-black/85', mark: <path d="M12 5c-4.7 0-8.5 2.9-8.5 6.5 0 2.3 1.6 4.4 4 5.5l-.9 3.3c-.1.3.3.6.6.4l3.8-2.5c.3 0 .7.1 1 .1 4.7 0 8.5-2.9 8.5-6.6S16.7 5 12 5z" fill="currentColor" /> },
  { id: 'apple', label: 'Apple로 계속하기', cls: 'bg-ink text-paper', mark: <path d="M15.6 12.6c0-2 1.6-2.9 1.7-3-1-1.4-2.4-1.6-2.9-1.6-1.2-.1-2.4.7-3 .7-.6 0-1.6-.7-2.6-.7-1.3 0-2.6.8-3.3 2-1.4 2.4-.4 6 1 8 .7 1 1.4 2 2.5 2 1 0 1.4-.6 2.6-.6s1.5.6 2.6.6c1.1 0 1.8-1 2.4-2 .8-1.1 1.1-2.2 1.1-2.3 0 0-2.1-.8-2.1-3.1zM13.7 6.6c.5-.7.9-1.6.8-2.5-.8 0-1.8.5-2.3 1.2-.5.6-1 1.5-.8 2.4.9.1 1.8-.4 2.3-1.1z" fill="currentColor" /> },
  { id: 'google', label: 'Google로 계속하기', cls: 'border border-hairline text-ink', mark: <><path d="M20.6 12.2c0-.6-.1-1.2-.2-1.8H12v3.4h4.8a4.1 4.1 0 01-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5z" fill="#4285F4" /><path d="M12 21c2.4 0 4.5-.8 5.9-2.2L15 16.6c-.8.5-1.8.9-3 .9-2.3 0-4.3-1.6-5-3.7H4v2.3A9 9 0 0012 21z" fill="#34A853" /><path d="M7 13.8a5.4 5.4 0 010-3.5V8H4a9 9 0 000 8.1l3-2.3z" fill="#FBBC05" /><path d="M12 6.6c1.3 0 2.5.5 3.4 1.3L18 5.4A9 9 0 004 8l3 2.3c.7-2.1 2.7-3.7 5-3.7z" fill="#EA4335" /></> },
]

export default function MemberLogin() {
  const nav = useNavigate()
  const [busy, setBusy] = useState<OAuthProvider | 'email' | null>(null)
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [failed, setFailed] = useState(false) // 아래 문구: 다시 입력할 때까지
  const [flash, setFlash] = useState(0) // 붉은 밑줄·흔들림: 잠깐 (실패할 때마다 다시)
  useEffect(() => {
    if (!flash) return
    const t = setTimeout(() => setFlash(0), 1400)
    return () => clearTimeout(t)
  }, [flash])
  const canLogin = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && pw.length > 0
  const go = async (p: OAuthProvider) => {
    setBusy(p)
    try { await api.signInOAuth(p) } catch (e) { toast(errorText(e)) } finally { setBusy(null) }
  }
  const login = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canLogin) return toast('이메일과 비밀번호를 입력해 주세요.')
    setBusy('email')
    try {
      await api.signInEmail(email, pw)
      nav('/calendar', { replace: true })
    } catch (err) {
      if (/invalid/i.test((err as Error)?.message ?? '')) { setFailed(true); setFlash(Date.now()) }
      else toast(errorText(err))
    } finally { setBusy(null) }
  }
  return (
    <div className="flex h-full flex-col">
      <AppHeader back />
      <div className="flex flex-1 flex-col px-6 pb-[max(24px,env(safe-area-inset-bottom))]">
        <h1 className="mt-4 t-large">회원 로그인</h1>
        {/* 이메일 로그인: 화면 가운데 */}
        <form onSubmit={login} className="my-auto py-8">
          <div key={flash} className={flash ? 'shake' : ''}>
            <TextField label="이메일" type="email" autoComplete="email" inputMode="email" value={email} invalid={!!flash}
              onChange={(e) => { setEmail(e.target.value.trim()); setFailed(false) }} />
            <TextField className="mt-5" label="비밀번호" type="password" autoComplete="current-password" value={pw} invalid={!!flash}
              onChange={(e) => { setPw(e.target.value); setFailed(false) }} />
          </div>
          {failed && <p role="alert" className="mt-2 t-sub text-danger">아이디 또는 비밀번호가 올바르지 않습니다</p>}
          <div className="mt-4 flex items-center justify-center t-sub">
            <Link to="/login/email" className="flex h-11 items-center px-3 text-graphite">이메일로 가입</Link>
            <span aria-hidden className="h-3 w-px bg-hairline" />
            <button type="submit" disabled={!!busy} className="flex h-11 items-center px-3 font-semibold disabled:opacity-50">
              {busy === 'email' ? '로그인 중…' : '로그인'}
            </button>
            <span aria-hidden className="h-3 w-px bg-hairline" />
            {/* shortcut: 실제 찾기 기능은 본인인증(보안 기획서 7장) 도입 때 함께 구현 */}
            <button type="button" onClick={() => toast('아이디/비밀번호 찾기는 본인인증과 함께 준비 중이에요.')}
              className="flex h-11 items-center px-3 text-graphite">아이디/비밀번호 찾기</button>
          </div>
        </form>
        <div className="flex flex-col gap-2.5">
          {PROVIDERS.map((p) => (
            <button key={p.id} onClick={() => go(p.id)} disabled={!!busy}
              className={`relative flex h-[52px] items-center justify-center rounded-[14px] t-head transition-opacity active:opacity-75 disabled:opacity-50 ${p.cls}`}>
              <svg aria-hidden viewBox="0 0 24 24" className="absolute left-5 h-5 w-5">{p.mark}</svg>
              {busy === p.id ? '연결하는 중…' : p.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
