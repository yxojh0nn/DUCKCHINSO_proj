import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type InfoCategory } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { ContributeSheet } from '@/components/ContributeSheet'
import { Button } from '@/components/ui/Button'
import { Empty } from '@/components/ui/Empty'
import { TextTabs } from '@/components/ui/TextTabs'
import { CATEGORIES, CATEGORY_LABEL } from '@/data/contrib'
import { fmtDateTime, fmtRelative } from '@/lib/date'
import { keys, useConcerts, useGenres, useMe, namesOf } from '@/lib/queries'
import { toast } from '@/store/ui'
import { useRun } from '@/lib/actions'

// 공연 상세 > 공연 정보: 회원이 제보하고 운영자가 검수해 공개한 정보. 예매 오픈일·장르도 함께 보이고,
// 제보에 동의한 사람의 닉네임만 표시한다. 본문은 일반 텍스트로만 보인다 (HTML 해석 안 함)
export default function ConcertInfo() {
  const { id = '' } = useParams()
  const qc = useQueryClient()
  const me = useMe().data
  const c = useConcerts().data?.find((x) => x.id === id)
  const genres = useGenres().data
  const extra = useQuery({ queryKey: keys.concertExtra(id), queryFn: () => api.concertExtra(id) })
  const [tab, setTab] = useState<InfoCategory>('artist')
  const [sheet, setSheet] = useState(false)
  const { busy, run } = useRun()
  if (!c) return <AppHeader back title="공연 정보" />

  const by = (kind: 'ticket_open' | 'genre') => extra.data?.find((x) => x.kind === kind)?.nickname
  const infos = (extra.data ?? []).filter((x) => x.kind === 'info' && x.category === tab)
  const genre = c.genreId ? namesOf(genres, [c.genreId])[0] : null
  const hide = (infoId: string) => run(async () => {
    await api.adminHideConcertInfo(infoId)
    await qc.invalidateQueries({ queryKey: keys.concertExtra(id) })
    toast('공연 정보를 내렸어요')
  })

  return (
    <div className="pb-[max(24px,env(safe-area-inset-bottom))]">
      <AppHeader back title="공연 정보" />
      <h1 className="px-5 pt-1 t-title">{c.title}</h1>
      <dl className="mt-3 border-t border-hairline px-5 py-2">
        <div className="grid grid-cols-[72px_1fr] gap-3 py-2">
          <dt className="t-sub text-graphite">예매 일자</dt>
          <dd className="t-body">
            {c.ticketOpenAt ? <span className="num">{fmtDateTime(c.ticketOpenAt)}</span> : <span className="text-graphite">미정</span>}
            {by('ticket_open') && <span className="block t-cap text-graphite">{by('ticket_open')} 님이 알려 줬어요</span>}
          </dd>
        </div>
        <div className="grid grid-cols-[72px_1fr] gap-3 py-2">
          <dt className="t-sub text-graphite">장르</dt>
          <dd className="t-body">
            {genre ?? <span className="text-graphite">미정</span>}
            {by('genre') && <span className="block t-cap text-graphite">{by('genre')} 님이 알려 줬어요</span>}
          </dd>
        </div>
      </dl>

      <div className="border-y border-hairline">
        <TextTabs label="공연 정보 분류" value={tab} onChange={setTab} tabs={CATEGORIES.map((v) => ({ value: v, label: CATEGORY_LABEL[v] }))} />
      </div>
      {infos.length ? (
        <ul>
          {infos.map((x) => (
            <li key={x.id} className="border-b border-hairline px-5 py-4">
              <p className="t-body font-semibold">{x.title}</p>
              <p className="mt-1 whitespace-pre-wrap break-words t-body">{x.body}</p>
              <p className="mt-2 t-cap text-graphite">{x.nickname ? `${x.nickname} 님 제보 · ` : ''}{fmtRelative(x.createdAt)}</p>
              {me?.isAdmin && <Button size="sm" variant="secondary" className="mt-2" disabled={busy} onClick={() => hide(x.id)}>내리기</Button>}
            </li>
          ))}
        </ul>
      ) : <Empty title={extra.isLoading ? '불러오는 중…' : '아직 등록된 정보가 없어요'} body={me && !me.isGuest ? '알고 있는 정보를 알려 주세요.' : undefined} />}

      {me && !me.isGuest && (
        <div className="px-5 pt-4">
          <Button block onClick={() => setSheet(true)}>{CATEGORY_LABEL[tab]} 알려 주기</Button>
          <p className="mt-2 text-center t-cap text-graphite">운영자가 확인해 반영하면 포인트를 드려요</p>
        </div>
      )}
      {sheet && <ContributeSheet key={tab} open onClose={() => setSheet(false)} concertId={c.id} kind="info" category={tab} />}
    </div>
  )
}
