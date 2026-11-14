import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { toast } from '@/store/ui'
import { useRun } from '@/lib/actions'

// 비밀번호 바꾸기: MY > 내 정보, 또는 비밀번호 재설정 메일의 링크로 들어온다 (이메일 가입 계정만)
export default function PasswordChange() {
  const nav = useNavigate()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const { busy, run } = useRun()
  const pwOk = pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw)
  const ok = pwOk && pw === pw2

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ok || busy) return
    return run(async () => {
      await api.updatePassword(pw)
      toast('비밀번호를 바꿨어요.')
      nav('/my/info', { replace: true })
    })
  }

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader back title="비밀번호 바꾸기" />
      <form onSubmit={submit} className="flex flex-1 flex-col px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-4">
        <TextField label="새 비밀번호" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)}
          hint="영문과 숫자를 섞어 8자 이상" error={pw && !pwOk ? '영문과 숫자를 섞어 8자 이상으로 만들어 주세요.' : undefined} />
        <TextField className="mt-5" label="새 비밀번호 확인" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)}
          error={pw2 && pw !== pw2 ? '비밀번호가 서로 달라요.' : undefined} />
        <Button type="submit" block className="mt-auto" disabled={!ok || busy}>{busy ? '바꾸는 중…' : '비밀번호 바꾸기'}</Button>
      </form>
    </div>
  )
}
