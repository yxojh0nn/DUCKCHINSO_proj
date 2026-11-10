import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorText, type AdminTicketTip } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { IconExternal } from '@/components/icons'
import { Button } from '@/components/ui/Button'
import { Empty } from '@/components/ui/Empty'
import { TextTabs } from '@/components/ui/TextTabs'
import { fmtDateTime, fmtRelative } from '@/lib/date'
import { openTicket } from '@/lib/external'
import { keys } from '@/lib/queries'
import { toast } from '@/store/ui'
import { adminKeys } from './AdminGate'

const STATUS: Record<AdminTicketTip['status'], string> = { pending: '대기', approved: '반영함', rejected: '거절' }

// 예매일 제보: 출처 링크를 열어 확인 → 반영(공연의 예매 오픈일로) / 거절
export default function TicketTips() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'pending' | 'done'>('pending')
  const [busy, setBusy] = useState<string | null>(null)
  const list = useQuery({ queryKey: adminKeys.tips, queryFn: () => api.adminTicketTips() })
  const shown = (list.data ?? []).filter((t) => (tab === 'pending') === (t.status === 'pending'))

  const resolve = async (t: AdminTicketTip, approve: boolean) => {
    if (busy) return
    setBusy(t.id)
    try {
      await api.adminResolveTicketTip(t.id, approve)
      await Promise.all([qc.invalidateQueries({ queryKey: adminKeys.tips }), qc.invalidateQueries({ queryKey: keys.concerts })])
      toast(approve ? '예매 오픈일에 반영하고 제보자에게 알렸어요' : '거절했어요')
    } catch (e) { toast(errorText(e)) } finally { setBusy(null) }
  }

  return (
    <>
      <AppHeader back title="예매일 제보" />
      <div className="border-b border-hairline">
        <TextTabs label="제보 처리 상태" value={tab} onChange={setTab} tabs={[{ value: 'pending', label: '확인 대기' }, { value: 'done', label: '처리됨' }]} />
      </div>
      {shown.length ? (
        <ul className="pb-8">
          {shown.map((t) => (
            <li key={t.id} className="border-b border-hairline px-5 py-4">
              <Link to={`/concert/${t.concertId}`} className="t-body font-semibold underline-offset-4 hover:underline">{t.concertTitle}</Link>
              <p className="mt-1 t-sub">
                제보 <b className="num">{fmtDateTime(t.openAt)}</b>
                <span className="text-graphite"> · 지금 {t.currentOpenAt ? <span className="num">{fmtDateTime(t.currentOpenAt)}</span> : '미정'}</span>
              </p>
              <button onClick={() => openTicket(t.sourceUrl)} className="mt-1 flex min-h-9 max-w-full items-center gap-1 t-sub text-graphite underline underline-offset-4">
                <span className="truncate">{t.sourceUrl}</span><IconExternal size={14} />
              </button>
              <p className="mt-1 t-cap text-graphite">
                {t.user?.nickname ?? '탈퇴한 사용자'} · {fmtRelative(t.createdAt)}{t.status !== 'pending' && ` · ${STATUS[t.status]}`}
              </p>
              {t.status === 'pending' && (
                <div className="mt-3 flex gap-2">
                  <Button size="md" disabled={!!busy} onClick={() => resolve(t, true)}>반영</Button>
                  <Button size="md" variant="secondary" disabled={!!busy} onClick={() => resolve(t, false)}>거절</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      ) : <Empty title={list.isLoading ? '불러오는 중…' : tab === 'pending' ? '확인할 제보가 없어요' : '처리한 제보가 없어요'} />}
    </>
  )
}
