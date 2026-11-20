import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { Empty } from '@/components/ui/Empty'
import { TextTabs } from '@/components/ui/TextTabs'
import { CATEGORY_LABEL, KIND_LABEL, STATUS_LABEL } from '@/data/contrib'
import { fmtDateTime, fmtRelative } from '@/lib/date'
import { keys } from '@/lib/queries'

// MY > 포인트: 잔액 + 지급 내역(어떤 제보로 받았는지) + 내 제보 진행 상황(반려 사유 포함)
export default function Points() {
  const [tab, setTab] = useState<'history' | 'mine'>('history')
  const points = useQuery({ queryKey: keys.points, queryFn: () => api.myPoints() })
  const mine = useQuery({ queryKey: keys.myContribs, queryFn: () => api.myContributions() })
  const restriction = useQuery({ queryKey: keys.contribRestriction, queryFn: () => api.myContribRestriction() })
  const balance = (points.data ?? []).reduce((s, p) => s + p.delta, 0)
  const r = restriction.data

  return (
    <div className="pb-8">
      <AppHeader back title="포인트" />
      <section className="px-5 pb-5 pt-2">
        <p className="t-sub text-graphite">내 포인트</p>
        <p className="mt-1 text-[32px] font-bold leading-tight num">{balance.toLocaleString('ko-KR')}P</p>
        <p className="mt-2 t-sub text-graphite">공연 상세에서 예매 오픈일·장르·공연 정보를 알려 주고, 운영자가 반영하면 포인트를 받아요.</p>
        {r && (
          <p className="mt-3 rounded-[12px] bg-mist px-3.5 py-3 t-sub">
            {r.endsAt ? `${fmtDateTime(r.endsAt)}까지` : '앞으로'} 정보 제보 기능을 쓸 수 없어요. 사유: {r.reason}
          </p>
        )}
      </section>
      <div className="border-y border-hairline">
        <TextTabs label="포인트 내역" value={tab} onChange={setTab} tabs={[{ value: 'history', label: '지급 내역' }, { value: 'mine', label: '내 제보' }]} />
      </div>

      {tab === 'history' ? (
        points.data?.length ? (
          <ul>
            {points.data.map((p, i) => (
              <li key={i} className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-3.5">
                <div className="min-w-0">
                  <p className="truncate t-body">{p.label}</p>
                  <p className="t-cap text-graphite">{fmtRelative(p.createdAt)}</p>
                </div>
                <span className={`shrink-0 t-body font-semibold num ${p.delta < 0 ? 'text-danger' : ''}`}>{p.delta > 0 ? '+' : ''}{p.delta}P</span>
              </li>
            ))}
          </ul>
        ) : <Empty title={points.isLoading ? '불러오는 중…' : '아직 받은 포인트가 없어요'} />
      ) : mine.data?.length ? (
        <ul>
          {mine.data.map((x) => (
            <li key={x.id} className="border-b border-hairline px-5 py-3.5">
              <p className="t-cap font-semibold text-graphite">
                {KIND_LABEL[x.kind]}{x.category && ` · ${CATEGORY_LABEL[x.category]}`} · {STATUS_LABEL[x.status]}{x.points > 0 && ` · +${x.points}P`}
              </p>
              <Link to={`/concert/${x.concertId}`} className="mt-0.5 block truncate t-body font-semibold">{x.concertTitle}</Link>
              <p className="t-sub text-graphite">
                {x.kind === 'ticket_open' && x.openAt ? fmtDateTime(x.openAt) : x.title ?? ''}
              </p>
              {x.rejectReason && <p className="mt-1 t-sub">반려 사유: {x.rejectReason}</p>}
              <p className="mt-0.5 t-cap text-graphite">{fmtRelative(x.createdAt)}</p>
            </li>
          ))}
        </ul>
      ) : <Empty title={mine.isLoading ? '불러오는 중…' : '보낸 제보가 없어요'} />}
    </div>
  )
}
