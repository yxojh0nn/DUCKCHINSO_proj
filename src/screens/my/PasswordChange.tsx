import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { toast } from '@/store/ui'
import { useRun } from '@/lib/actions'

// 비밀번호 바꾸기: MY > 내 정보 (이메일 가입 계정만). 현재 비밀번호를 서버가 확인한다 — 세션만 훔친 사람은 못 바꾼다
// (비밀번호를 잊었으면 로그인 화면의 비밀번호 찾기로 메일 코드를 받아 바꾼다)
export default function PasswordChange() {
  const nav = useNavigate()
  const [current, setCurrent] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const { busy, run } = useRun()
  const pwOk = pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw)
  const ok = !!current && pwOk && pw === pw2

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ok || busy) return
    return run(async () => {
      await api.updatePassword(current, pw)
      toast('비밀번호를 바꿨어요.')
      nav('/my/info', { replace: true })
    })
  }

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader back title="비밀번호 바꾸기" />
      <form onSubmit={submit} className="flex flex-1 flex-col px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-4">
        <TextField label="현재 비밀번호" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        <TextField className="mt-5" label="새 비밀번호" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)}
          hint="영문과 숫자를 섞어 8자 이상" error={pw && !pwOk ? '영문과 숫자를 섞어 8자 이상으로 만들어 주세요.' : undefined} />
        <TextField className="mt-5" label="새 비밀번호 확인" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)}
          error={pw2 && pw !== pw2 ? '비밀번호가 서로 달라요.' : undefined} />
        <Button type="submit" block className="mt-auto" disabled={!ok || busy}>{busy ? '바꾸는 중…' : '비밀번호 바꾸기'}</Button>
      </form>
    </div>
  )
}
