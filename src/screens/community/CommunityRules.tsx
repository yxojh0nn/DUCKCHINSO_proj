import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { Button } from '@/components/ui/Button'
import { CheckMark } from '@/components/ui/Checkbox'
import { COMMUNITY_RULES } from '@/data/consent'
import { keys, useMe } from '@/lib/queries'
import { useRun } from '@/lib/actions'

// 커뮤니티 이용 규약 동의 (계정마다 최초 1회, 회원·비회원 따로)
export default function CommunityRules() {
  const nav = useNavigate()
  const { search } = useLocation() // 커뮤니티에서 넘겨받은 검색어
  const qc = useQueryClient()
  const me = useMe().data
  const [ok, setOk] = useState(false)
  const { busy, run } = useRun()
  const agree = async () => {
    return run(async () => {
      await api.updateMe({ communityAgreed: true })
      await qc.invalidateQueries({ queryKey: keys.me })
      nav(me?.profileSetupDone ? `/community${search}` : '/community/setup', { replace: true })
    })
  }
  return (
    <div className="flex min-h-full flex-col">
      <AppHeader back={() => nav('/calendar')} />
      <div className="flex flex-1 flex-col px-6 pb-[max(24px,env(safe-area-inset-bottom))]">
        <h1 className="mt-2 t-large">커뮤니티 이용 규약</h1>
        <ol className="mt-6 space-y-5">
          {COMMUNITY_RULES.map((r, i) => (
            <li key={r.title} className="grid grid-cols-[24px_1fr] gap-2">
              <span className="t-head text-graphite num">{i + 1}</span>
              <div><p className="t-head">{r.title}</p><p className="mt-1 t-sub text-graphite">{r.body}</p></div>
            </li>
          ))}
        </ol>
        <button aria-pressed={ok} onClick={() => setOk(!ok)} className="mt-8 flex min-h-12 items-center gap-3 text-left t-body font-semibold">
          <CheckMark checked={ok} />위 내용을 확인했고 지키겠습니다
        </button>
        <Button block className="mt-auto" disabled={!ok || busy} onClick={agree}>동의하고 커뮤니티 시작</Button>
      </div>
    </div>
  )
}
