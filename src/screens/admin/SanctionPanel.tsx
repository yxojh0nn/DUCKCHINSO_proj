import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, errorText, type SanctionLevel } from '@/api'
import { Button } from '@/components/ui/Button'
import { Confirm } from '@/components/ui/Confirm'
import { TextField } from '@/components/ui/Field'
import { toast } from '@/store/ui'

type Choice = { value: string; label: string; level: SanctionLevel; days?: number }
const SANCTIONS: Choice[] = [
  { value: 'warning', label: '경고', level: 'warning' },
  { value: 'd7', label: '7일 제한', level: 'suspend', days: 7 },
  { value: 'd30', label: '30일 제한', level: 'suspend', days: 30 },
  { value: 'ban', label: '영구 제한', level: 'ban' },
]
// DB 함수 admin_sanction 과 같은 규칙 (마이그레이션 14)
const WARNING_RULE = '경고가 쌓이면 자동으로 제재돼요: 1회 7일, 2회 14일 커뮤니티·채팅 이용 제한, 3회 계정 정지.'

// 제재 고르기 → 사유 → 확인 → 적용 (신고 상세·사용자 상세에서 함께 쓴다). 영구 제한된 사람·운영자는 부르는 쪽에서 숨긴다
export function SanctionPanel({ target, defaultReason = '', title = '제재' }: { target: { id: string; nickname: string }; defaultReason?: string; title?: string }) {
  const qc = useQueryClient()
  const [choice, setChoice] = useState<Choice>(SANCTIONS[0])
  const [why, setWhy] = useState(defaultReason)
  const [confirm, setConfirm] = useState(false)
  const [busy, setBusy] = useState(false)

  const apply = async () => {
    setConfirm(false)
    setBusy(true)
    try {
      await api.adminSanction(target.id, choice.level, why, choice.days)
      await qc.invalidateQueries({ queryKey: ['admin'] })
      toast(`${target.nickname} 님에게 ${choice.label}을 적용하고 알렸어요`)
    } catch (e) { toast(errorText(e)) } finally { setBusy(false) }
  }

  return (
    <section className="mt-8 border-t border-hairline px-5 pt-5">
      <h2 className="t-head">{title}</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {SANCTIONS.map((s) => (
          <button key={s.value} aria-pressed={choice.value === s.value} onClick={() => setChoice(s)}
            className={`h-9 rounded-full px-3.5 t-sub ${choice.value === s.value ? (s.level === 'warning' ? 'bg-ink font-semibold text-paper' : 'bg-danger font-semibold text-white') : 'bg-mist'}`}>
            {s.label}
          </button>
        ))}
      </div>
      {choice.level === 'warning' && <p className="mt-3 t-sub text-graphite">{WARNING_RULE}</p>}
      <TextField className="mt-4" label="사유 (당사자에게 그대로 보여요)" value={why} onChange={(e) => setWhy(e.target.value)} maxLength={200} />
      <Button block variant={choice.level === 'warning' ? 'secondary' : 'dangerFill'} className="mt-4" disabled={busy || !why.trim()} onClick={() => setConfirm(true)}>
        {choice.label} 적용
      </Button>
      <Confirm open={confirm} title={`${target.nickname} 님에게 ${choice.label}을 적용할까요?`}
        message={choice.level === 'ban' ? '영구 제한은 되돌리려면 DB에서 직접 풀어야 해요. 당사자에게 운영팀 대화방으로 알려요.'
          : choice.level === 'warning' ? `${WARNING_RULE} 당사자에게 운영팀 대화방으로 알려요.` : '당사자에게 운영팀 대화방으로 알려요.'}
        confirmLabel="적용" danger={choice.level !== 'warning'} onClose={() => setConfirm(false)} onConfirm={apply} />
    </section>
  )
}
