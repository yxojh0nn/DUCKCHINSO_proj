import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type AdminContribution, type AdminContributionTab } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { IconExternal } from '@/components/icons'
import { Button } from '@/components/ui/Button'
import { Confirm } from '@/components/ui/Confirm'
import { Empty } from '@/components/ui/Empty'
import { TextField } from '@/components/ui/Field'
import { TextTabs } from '@/components/ui/TextTabs'
import { CATEGORY_LABEL, KIND_LABEL, STATUS_LABEL, looksPersonal, penaltyFor } from '@/data/contrib'
import { fmtDateTime, fmtRelative } from '@/lib/date'
import { openTicket } from '@/lib/external'
import { keys, useGenres, namesOf } from '@/lib/queries'
import { toast } from '@/store/ui'
import { useRun } from '@/lib/actions'
import { adminKeys } from './AdminGate'

const TABS: { value: AdminContributionTab; label: string }[] = [
  { value: 'pending', label: '검수 대기' }, { value: 'done', label: '검수 완료' }, { value: 'penalized', label: '거부 및 제재' },
]

// 정보 제보 검수: 작성 유저·아티스트·내용을 보고 적용 / 거부 / 거부 및 제재
export default function Contributions() {
  const [tab, setTab] = useState<AdminContributionTab>('pending')
  const list = useQuery({ queryKey: adminKeys.contribs(tab), queryFn: () => api.adminContributions(tab) })
  return (
    <>
      <AppHeader back title="정보 제보 검수" />
      <div className="border-b border-hairline">
        <TextTabs label="검수 상태" value={tab} onChange={setTab} tabs={TABS} />
      </div>
      {list.data?.length ? <ul className="pb-8">{list.data.map((x) => <Item key={x.id} x={x} />)}</ul>
        : <Empty title={list.isLoading ? '불러오는 중…' : '제보가 없어요'} />}
    </>
  )
}

function Item({ x }: { x: AdminContribution }) {
  const qc = useQueryClient()
  const genres = useGenres().data
  const { busy, run } = useRun()
  const [points, setPoints] = useState('20')
  const [rejecting, setRejecting] = useState(false)
  const [why, setWhy] = useState('')
  const [confirm, setConfirm] = useState<'approve' | 'penalize' | null>(null)
  const genre = (id: number | null) => (id ? namesOf(genres, [id])[0] : null) ?? '없음'
  const pts = Number(points)
  const ptsOk = x.kind !== 'info' || (/^\d+$/.test(points) && pts <= 30)
  const personal = looksPersonal(`${x.title ?? ''} ${x.body ?? ''}`)

  const done = (msg: string) => async () => {
    await Promise.all([qc.invalidateQueries({ queryKey: ['admin', 'contribs'] }), qc.invalidateQueries({ queryKey: keys.concerts })])
    toast(msg)
  }
  const approve = () => run(async () => {
    setConfirm(null)
    await api.adminApproveContribution(x.id, x.kind === 'info' ? pts : undefined)
    await done('반영하고 제보자에게 알렸어요')()
  })
  const reject = (penalize: boolean) => run(async () => {
    setConfirm(null)
    await api.adminRejectContribution(x.id, why, penalize)
    await done(penalize ? '반려하고 제보 기능을 정지했어요' : '반려하고 사유를 알렸어요')()
  })

  return (
    <li className="border-b border-hairline px-5 py-4">
      <p className="t-cap font-semibold text-graphite">
        {KIND_LABEL[x.kind]}{x.category && ` · ${CATEGORY_LABEL[x.category]}`}
        {x.status !== 'pending' && ` · ${STATUS_LABEL[x.status]}`}{x.points > 0 && ` · +${x.points}P`}
      </p>
      <Link to={`/concert/${x.concertId}`} className="mt-1 block t-body font-semibold underline-offset-4 hover:underline">{x.concertTitle}</Link>
      <p className="t-sub text-graphite">아티스트 {x.artists || '미정'}</p>

      <div className="mt-2 rounded-[12px] bg-mist px-3.5 py-3 t-sub">
        {x.kind === 'ticket_open' && x.openAt && (
          <p>제보 <b className="num">{fmtDateTime(x.openAt)}</b><span className="text-graphite"> · 지금 {x.currentOpenAt ? <span className="num">{fmtDateTime(x.currentOpenAt)}</span> : '미정'}</span></p>
        )}
        {x.kind === 'genre' && <p>제보 <b>{genre(x.genreId)}</b><span className="text-graphite"> · 지금 {genre(x.currentGenreId)}</span></p>}
        {x.kind === 'info' && (
          <>
            <p className="font-semibold">{x.title}</p>
            {/* 일반 텍스트로만 보인다 (HTML 해석 안 함) */}
            <p className="mt-1 whitespace-pre-wrap break-words">{x.body}</p>
            {personal && <p className="mt-2 font-semibold text-danger">개인정보(전화번호·이메일·계좌)로 보이는 내용이 있어요</p>}
          </>
        )}
        {x.sourceUrl && (
          <button onClick={() => openTicket(x.sourceUrl!)} className="mt-1 flex min-h-9 max-w-full items-center gap-1 text-graphite underline underline-offset-4">
            <span className="truncate">{x.sourceUrl}</span><IconExternal size={14} />
          </button>
        )}
      </div>

      <p className="mt-2 t-cap text-graphite">
        {x.user ? (
          <>
            <Link to={`/admin/users/${x.user.id}`} className="font-semibold text-ink underline underline-offset-4">{x.user.nickname}</Link>
            {` · 채택 ${x.user.approved} · 반려 ${x.user.rejected} · 제재 ${x.user.penalties}`}
            {x.user.restrictedUntil && ` · 제보 정지 중(${x.user.restrictedUntil === 'forever' ? '영구' : `~${fmtDateTime(x.user.restrictedUntil)}`})`}
          </>
        ) : '탈퇴한 사용자'}
        {` · ${fmtRelative(x.createdAt)}`}
      </p>
      {x.rejectReason && <p className="mt-1 t-sub">반려 사유: {x.rejectReason}</p>}

      {x.status === 'pending' && (
        rejecting ? (
          <div className="mt-3">
            <TextField label="반려 사유 (제보자에게 그대로 보여요)" value={why} onChange={(e) => setWhy(e.target.value)} maxLength={200} />
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="md" variant="secondary" disabled={busy || !why.trim()} onClick={() => reject(false)}>거부</Button>
              <Button size="md" variant="dangerFill" disabled={busy || !why.trim() || !x.user} onClick={() => setConfirm('penalize')}>거부 및 제재</Button>
              <Button size="md" variant="secondary" disabled={busy} onClick={() => setRejecting(false)}>취소</Button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-end gap-2">
            {x.kind === 'info' && (
              <TextField className="w-28" label="포인트 (0~30)" inputMode="numeric" value={points} onChange={(e) => setPoints(e.target.value.trim())}
                error={ptsOk ? undefined : '0~30 정수'} />
            )}
            <Button size="md" disabled={busy || !ptsOk} onClick={() => setConfirm('approve')}>적용</Button>
            <Button size="md" variant="secondary" disabled={busy} onClick={() => setRejecting(true)}>거부</Button>
          </div>
        )
      )}

      <Confirm open={confirm === 'approve'} title="이 제보를 적용할까요?"
        message={x.kind === 'info' ? `공연 정보 페이지에 공개하고 제보자에게 ${pts}포인트를 드려요.` : '공연 상세에 반영하고 제보자에게 포인트를 드려요. 같은 공연의 같은 종류 대기 제보는 중복으로 닫혀요.'}
        confirmLabel="적용" onClose={() => setConfirm(null)} onConfirm={approve} />
      <Confirm open={confirm === 'penalize'} title="거부하고 제재할까요?"
        message={`최근 1년 제재 ${x.user?.penalties ?? 0}회 → 이번에 제보 기능 ${penaltyFor(x.user?.penalties ?? 0)} 정지. 실수가 아니라 고의로 잘못된 정보를 보낸 경우에만 골라 주세요.`}
        confirmLabel="거부 및 제재" danger onClose={() => setConfirm(null)} onConfirm={() => reject(true)} />
    </li>
  )
}
