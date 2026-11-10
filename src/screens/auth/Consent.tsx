import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api, errorText } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { ConsentList, allRequired } from '@/components/ConsentList'
import { Button } from '@/components/ui/Button'
import { keys } from '@/lib/queries'
import { toast } from '@/store/ui'

// 서비스 이용 동의. 비회원은 동의 후에 임시 계정을 만든다 (기획서 9장)
// 소셜 로그인으로 처음 들어온 회원도 이 화면을 거친다
export default function Consent() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const guest = useSearchParams()[0].get('guest') === '1'
  const [value, setValue] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)

  const agree = async () => {
    setBusy(true)
    try {
      if (!(await api.sessionUserId())) await api.signInGuest()
      await api.saveConsents(value)
      // 이 화면에는 me 를 보는 곳이 없어 'all' 이 아니면 다시 받지 않는다. 옛 값으로 이동하면 Gate 가 이 화면으로 되돌린다
      await qc.invalidateQueries({ queryKey: keys.me, refetchType: 'all' })
      nav('/calendar', { replace: true })
    } catch (e) {
      toast(errorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader back={guest} />
      <div className="flex flex-1 flex-col px-6 pb-[max(24px,env(safe-area-inset-bottom))]">
        <h1 className="mt-2 t-large">시작하기 전에</h1>
        <p className="mt-2 t-body text-graphite">
          덕친소를 쓰려면 아래 필수 항목에 동의해 주세요.{guest && ' 동의하면 익명 닉네임이 발급돼요.'}
        </p>
        <div className="mt-6">
          <ConsentList value={value} onChange={setValue} />
        </div>
        <Button block className="mt-auto" disabled={!allRequired(value) || busy} onClick={agree}>
          {busy ? '준비 중…' : '동의하고 시작하기'}
        </Button>
      </div>
    </div>
  )
}
