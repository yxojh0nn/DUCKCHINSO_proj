import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, type AdminReport } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { REPORT_REASONS } from '@/components/ReportSheet'
import { Empty } from '@/components/ui/Empty'
import { TextTabs } from '@/components/ui/TextTabs'
import { fmtRelative } from '@/lib/date'
import { isKlipyUrl } from '@/lib/klipy'
import { adminKeys } from './AdminGate'

export const KIND_LABEL: Record<AdminReport['kind'], string> = { post: '글', comment: '댓글', message: '채팅', profile: '프로필' }
export const reasonLabel = (r: AdminReport['reason']) => REPORT_REASONS.find((x) => x.value === r)?.label ?? r
// 신고 시점 원문. KLIPY GIF 메시지면 원문이 GIF 주소라 그림으로 보여 준다
export function Snapshot({ text, className }: { text: string | null; className: string }) {
  return text && isKlipyUrl(text)
    ? <img src={text} alt="신고된 GIF" className="mt-1 max-h-40 rounded-lg bg-mist" />
    : <p className={className}>{text || '(원문 없음)'}</p>
}

// 신고: 처리 대기(오래된 것부터 보기 쉽게 최신순) / 처리됨
export default function Reports() {
  const [tab, setTab] = useState<'open' | 'done'>('open')
  const list = useQuery({ queryKey: adminKeys.reports, queryFn: () => api.adminReports() })
  const shown = (list.data ?? []).filter((r) => (tab === 'open') === (r.status === 'open'))
  return (
    <>
      <AppHeader back title="신고" />
      <div className="border-b border-hairline">
        <TextTabs label="신고 처리 상태" value={tab} onChange={setTab} tabs={[{ value: 'open', label: '처리 대기' }, { value: 'done', label: '처리됨' }]} />
      </div>
      {shown.length ? (
        <ul className="pb-8">
          {shown.map((r) => (
            <li key={r.id}>
              <Link to={`/admin/reports/${r.id}`} className="block px-5 py-3.5 active:bg-mist">
                <p className="flex items-center gap-2 t-sub">
                  <span className={`font-semibold ${r.reason === 'scam' || r.reason === 'sexual' ? 'text-danger' : ''}`}>{reasonLabel(r.reason)}</span>
                  <span className="text-graphite">{KIND_LABEL[r.kind]} · {fmtRelative(r.createdAt)}</span>
                  {r.status !== 'open' && <span className="ml-auto text-graphite">{r.status === 'resolved' ? '조치함' : '기각'}</span>}
                </p>
                <Snapshot text={r.snapshot} className="mt-1 line-clamp-2 t-body" />
                <p className="mt-1 t-cap text-graphite">
                  대상 {r.target?.nickname ?? '알 수 없음'}{r.priorSanctions ? ` · 이전 제재 ${r.priorSanctions}회` : ''}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : <Empty title={list.isLoading ? '불러오는 중…' : tab === 'open' ? '처리할 신고가 없어요' : '처리한 신고가 없어요'} />}
    </>
  )
}
