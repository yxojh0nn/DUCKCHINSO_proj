import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { Empty } from '@/components/ui/Empty'
import { TextTabs } from '@/components/ui/TextTabs'
import { adminKeys } from './AdminGate'

const PERIODS = [{ value: '7', label: '7일' }, { value: '30', label: '30일' }, { value: '365', label: '1년' }] as const
type Period = (typeof PERIODS)[number]['value']

// 예매 링크 클릭: 예매처 제휴 협의용 송객 실적. 같은 사람·같은 링크는 10분에 한 번만 센다
export default function TicketClicks() {
  const [period, setPeriod] = useState<Period>('30')
  const days = Number(period)
  const list = useQuery({ queryKey: adminKeys.clicks(days), queryFn: () => api.adminTicketClicks(days) })
  const rows = list.data ?? []
  const vendors = Object.entries(rows.reduce<Record<string, number>>((m, r) => ({ ...m, [r.vendor]: (m[r.vendor] ?? 0) + r.clicks }), {}))
    .sort((a, b) => b[1] - a[1])

  return (
    <>
      <AppHeader back title="예매 링크 클릭" />
      <div className="border-b border-hairline">
        <TextTabs label="기간" value={period} onChange={setPeriod} tabs={[...PERIODS]} />
      </div>
      {rows.length ? (
        <>
          <h2 className="px-5 pb-1 pt-5 t-sub font-semibold text-graphite">예매처별 클릭</h2>
          <ul className="px-5">
            {vendors.map(([v, n]) => (
              <li key={v} className="flex items-center justify-between border-b border-hairline py-3 t-body">
                <span>{v}</span><b className="num">{n.toLocaleString()}</b>
              </li>
            ))}
          </ul>
          <h2 className="px-5 pb-1 pt-6 t-sub font-semibold text-graphite">공연별 (많은 순)</h2>
          <ul className="pb-8">
            {rows.map((r) => (
              <li key={`${r.concertId}-${r.vendor}`} className="border-b border-hairline px-5 py-3">
                {r.concertId
                  ? <Link to={`/concert/${r.concertId}`} className="t-body font-semibold underline-offset-4 hover:underline">{r.concertTitle}</Link>
                  : <span className="t-body text-graphite">지워진 공연</span>}
                <p className="mt-1 t-sub text-graphite">
                  {r.vendor} · 클릭 <b className="num text-ink">{r.clicks.toLocaleString()}</b> · 사람 <span className="num">{r.users.toLocaleString()}</span>
                </p>
              </li>
            ))}
          </ul>
        </>
      ) : <Empty title={list.isLoading ? '불러오는 중…' : list.isError ? '불러오지 못했어요' : '이 기간에 기록된 클릭이 없어요'} />}
    </>
  )
}
