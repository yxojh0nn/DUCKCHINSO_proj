import { useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type AdminMembershipAction } from '@/api'
import { Button } from '@/components/ui/Button'
import { Confirm } from '@/components/ui/Confirm'
import { TextField } from '@/components/ui/Field'
import { fmtDateTime } from '@/lib/date'
import { won } from '@/lib/payment'
import { toast } from '@/store/ui'
import { useRun } from '@/lib/actions'

const ACTIONS: { action: AdminMembershipAction; label: string; done: string }[] = [
  { action: 'subscribe', label: '구독 1개월 연장', done: '구독을 1개월 늘렸어요' },
  { action: 'end_sub', label: '구독 지금 끝내기', done: '구독을 끝냈어요' },
  { action: 'clear', label: '멤버십 지우기', done: '멤버십을 지웠어요' },
]
const STATE: Record<string, string> = { active: '결제 중', past_due: '결제 실패 (재시도 중)', ended: '끝남', revoked: '환불로 끝남' }

// 사용자 상세 > 멤버십: 결제 구독이 있으면 결제 정보와 환불, 없으면 시험 지급
export function MembershipPanel({ userId }: { userId: string }) {
  const qc = useQueryClient()
  const key = ['admin', 'membership', userId]
  const q = useQuery({ queryKey: key, queryFn: () => api.adminMembership(userId) })
  const { busy, run } = useRun()
  const m = q.data
  const live = !!m?.subUntil && Date.parse(m.subUntil) > Date.now()
  const paidLive = m?.subState === 'active' || m?.subState === 'past_due' // DB 가 시험 지급을 막는다 (has_paid_subscription)
  const apply = (a: (typeof ACTIONS)[number]) => run(async () => {
    await api.adminSetMembership(userId, a.action)
    await qc.invalidateQueries({ queryKey: key })
    toast(a.done)
  })
  return (
    <section className="mt-8 border-t border-hairline px-5 pt-5">
      <h2 className="t-head">멤버십</h2>
      <dl className="mt-2 space-y-1.5 t-sub">
        <Item label="구독">{live ? `${m!.months}개월째 · ${fmtDateTime(m!.subUntil!)}까지` : m?.subUntil ? `끝남 (${fmtDateTime(m.subUntil)})` : '없음'}</Item>
        {m?.subState && <Item label="결제">{STATE[m.subState]}{m.methodLabel ? ` · ${m.methodLabel}` : ''}</Item>}
        {m?.paidAt && <Item label="이번 결제">{fmtDateTime(m.paidAt)} · 환불 가능 {won(m.refundableKrw ?? 0)}{m.within7days ? ' · 7일 이내' : ''}</Item>}
      </dl>
      {paidLive ? null : (
        <div className="mt-3 flex flex-wrap gap-2">
          {ACTIONS.map((a) => <Button key={a.action} size="sm" variant="secondary" disabled={busy} onClick={() => apply(a)}>{a.label} (시험)</Button>)}
        </div>
      )}
      {m?.subscriptionId != null && !!m.refundableKrw && <Refund subscriptionId={m.subscriptionId} amount={m.refundableKrw} onDone={() => qc.invalidateQueries({ queryKey: key })} />}
    </section>
  )
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return <div className="flex gap-3"><dt className="w-16 shrink-0 text-graphite">{label}</dt><dd>{children}</dd></div>
}

// 환불: 이번 기간 결제 남은 금액 전액 취소 → 구독 바로 끝. 금액은 서버가 다시 확인한다
function Refund({ subscriptionId, amount, onDone }: { subscriptionId: number; amount: number; onDone: () => unknown }) {
  const [why, setWhy] = useState('')
  const [ask, setAsk] = useState(false)
  const { busy, run } = useRun()
  const go = () => {
    setAsk(false)
    return run(async () => {
      const r = await api.adminRefund(subscriptionId, why.trim())
      await onDone()
      toast(`${won(r.refundedKrw)} 환불했어요. 구독이 끝났어요`)
      setWhy('')
    })
  }
  return (
    <div className="mt-4">
      <TextField label="환불 사유 (기록에 남아요)" value={why} maxLength={200} onChange={(e) => setWhy(e.target.value)} placeholder="예: 결제 후 7일 이내 요청" />
      <Button block variant="dangerFill" className="mt-2" disabled={busy || why.trim().length < 2} onClick={() => setAsk(true)}>{won(amount)} 환불</Button>
      <Confirm open={ask} title={`${won(amount)}을 환불할까요?`} confirmLabel="환불" danger
        message="결제사에서 바로 취소되고 구독이 지금 끝나요. 되돌릴 수 없어요." onConfirm={go} onClose={() => setAsk(false)} />
    </div>
  )
}
