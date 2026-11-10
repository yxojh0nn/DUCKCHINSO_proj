import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api, errorText, LOGIN_ID } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { keys } from '@/lib/queries'
import { toast } from '@/store/ui'

// 아이디 만들기: 아이디 없이 가입한 예전 이메일 계정이 거친다 (Gate 가 보냄). 새 가입은 가입 화면에서 아이디를 받는다
export default function LoginIdSetup() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const [id, setId] = useState('')
  const [busy, setBusy] = useState(false)
  const ok = LOGIN_ID.test(id)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ok || busy) return
    setBusy(true)
    try {
      await api.setLoginId(id)
      await qc.invalidateQueries({ queryKey: keys.me })
      toast('아이디를 만들었어요. 다음부터 이 아이디로 로그인해 주세요.')
      nav('/calendar', { replace: true })
    } catch (err) {
      toast(errorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader />
      <form onSubmit={submit} className="flex flex-1 flex-col px-6 pb-[max(24px,env(safe-area-inset-bottom))]">
        <h1 className="mt-2 t-large">아이디 만들기</h1>
        <p className="mt-2 t-body text-graphite">로그인할 때 이메일 대신 쓸 아이디예요. 나만 볼 수 있고, 다른 사람에게는 닉네임만 보여요.</p>
        <TextField className="mt-8" label="아이디" autoComplete="username" autoCapitalize="none" spellCheck={false} maxLength={20}
          value={id} onChange={(e) => setId(e.target.value.trim().toLowerCase())}
          hint="영문 소문자로 시작, 영문 소문자·숫자·밑줄(_) 4~20자"
          error={id && !ok ? '영문 소문자로 시작하고, 영문 소문자·숫자·밑줄로 4~20자여야 해요.' : undefined} />
        <Button type="submit" block className="mt-auto" disabled={!ok || busy}>{busy ? '만드는 중…' : '아이디 만들기'}</Button>
      </form>
    </div>
  )
}
