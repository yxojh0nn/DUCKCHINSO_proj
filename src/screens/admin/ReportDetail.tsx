import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorText, type AdminReport } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { Button } from '@/components/ui/Button'
import { CheckMark } from '@/components/ui/Checkbox'
import { Empty } from '@/components/ui/Empty'
import { fmtDateTime } from '@/lib/date'
import { toast } from '@/store/ui'
import { adminKeys } from './AdminGate'
import { KIND_LABEL, reasonLabel, Snapshot } from './Reports'
import { SanctionPanel } from './SanctionPanel'

const HIDE_LABEL = { post: '글 숨기기', comment: '댓글 지우기', message: '채팅 메시지 가리기', profile: '' } as const
const TARGET_STATUS = { active: '정상', suspended: '이용 제한 중', banned: '영구 제한' } as const

// 신고 한 건: 원문 확인 → 내용 가리기와 함께 조치 완료, 또는 기각 → 필요하면 작성자 제재
export default function ReportDetail() {
  const { id = '' } = useParams()
  const list = useQuery({ queryKey: adminKeys.reports, queryFn: () => api.adminReports() })
  const r = list.data?.find((x) => x.id === id)
  if (!r) return <><AppHeader back title="신고" />{list.isFetched && <Empty title="신고를 찾을 수 없어요" />}</>
  return <ReportForm r={r} />
}

function ReportForm({ r }: { r: AdminReport }) {
  const nav = useNavigate()
  const qc = useQueryClient()
  const [hide, setHide] = useState(r.kind !== 'profile')
  const [busy, setBusy] = useState(false)
  const open = r.status === 'open'

  const refresh = () => qc.invalidateQueries({ queryKey: ['admin'] })
  const resolve = async (resolution: 'resolved' | 'dismissed') => {
    setBusy(true)
    try {
      await api.adminResolveReport(r.id, resolution, resolution === 'resolved' && hide)
      await refresh()
      toast(resolution === 'resolved' ? '조치 완료로 처리했어요' : '기각했어요')
      nav('/admin/reports', { replace: true })
    } catch (e) { toast(errorText(e)) } finally { setBusy(false) }
  }

  return (
    <div className="pb-10">
      <AppHeader back title="신고" />
      <section className="px-5 pt-2">
        <p className="t-sub text-graphite">{KIND_LABEL[r.kind]} 신고 · {fmtDateTime(r.createdAt)}{!open && ` · ${r.status === 'resolved' ? '조치함' : '기각'}`}</p>
        <h1 className="mt-1 t-title">{reasonLabel(r.reason)}</h1>
        {r.detail && <p className="mt-1 t-body text-graphite">{r.detail}</p>}
        <div className="mt-4 rounded-[12px] bg-mist px-4 py-3">
          <p className="t-cap text-graphite">신고 시점 원문</p>
          <Snapshot text={r.snapshot} className="mt-1 whitespace-pre-wrap break-words t-body" />
        </div>
        {r.postId && <Link to={`/community/post/${r.postId}`} className="mt-2 inline-flex h-9 items-center t-sub font-semibold underline underline-offset-4">글 보러 가기</Link>}
        <dl className="mt-3 space-y-1 t-sub">
          <div className="flex gap-3"><dt className="w-14 shrink-0 text-graphite">신고자</dt><dd>{r.reporter?.nickname ?? '탈퇴한 사용자'}</dd></div>
          <div className="flex gap-3"><dt className="w-14 shrink-0 text-graphite">대상</dt>
            <dd>{r.target ? <>{r.target.nickname} · {TARGET_STATUS[r.target.status]}{r.priorSanctions ? ` · 이전 제재 ${r.priorSanctions}회` : ''}</> : '알 수 없음'}</dd></div>
        </dl>
      </section>

      {open && (
        <section className="mt-6 px-5">
          {r.kind !== 'profile' && (
            <button aria-pressed={hide} onClick={() => setHide(!hide)} className="flex min-h-11 items-center gap-3 text-left t-body">
              <CheckMark checked={hide} />조치 완료 때 {HIDE_LABEL[r.kind]}
            </button>
          )}
          <div className="mt-3 flex gap-2">
            <Button variant="secondary" className="flex-1" disabled={busy} onClick={() => resolve('dismissed')}>기각</Button>
            <Button className="flex-[2]" disabled={busy} onClick={() => resolve('resolved')}>조치 완료</Button>
          </div>
          <p className="mt-2 t-cap text-graphite">같은 내용에 들어온 다른 신고도 함께 처리돼요.</p>
        </section>
      )}

      {r.target && r.target.status !== 'banned' && <SanctionPanel target={r.target} defaultReason={reasonLabel(r.reason)} title="작성자 제재" />}
    </div>
  )
}
