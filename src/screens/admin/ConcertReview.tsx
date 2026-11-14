import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorText, type AdminConcert, type Artist } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { Poster } from '@/components/Poster'
import { IconClose } from '@/components/icons'
import { SearchField } from '@/components/ui/Field'
import { Button } from '@/components/ui/Button'
import { Confirm } from '@/components/ui/Confirm'
import { Empty } from '@/components/ui/Empty'
import { fmtRange } from '@/lib/date'
import { keys, useArtists } from '@/lib/queries'
import { toast } from '@/store/ui'
import { adminKeys } from './AdminGate'

// 예매 오픈 일시: 화면은 KST(datetime-local), 저장은 ISO
const toLocal = (iso: string | null) => iso ? new Date(new Date(iso).getTime() + 9 * 3_600_000).toISOString().slice(0, 16) : ''
const fromLocal = (v: string) => v ? new Date(`${v}:00+09:00`).toISOString() : null
const STATUS = { published: '게시됨', review: '검수 대기', hidden: '숨김' } as const

// 검수 대기 공연 한 건: 판단 근거 확인 → 아티스트 연결 → 예매 오픈 일시 → 게시 또는 숨김
export default function ConcertReview() {
  const { id = '' } = useParams()
  const concert = useQuery({ queryKey: adminKeys.concert(id), queryFn: () => api.adminGetConcert(id) })
  if (!concert.data) return <><AppHeader back title="공연 검수" />{concert.isError ? <Empty title="공연을 찾을 수 없어요" /> : null}</>
  return <ReviewForm c={concert.data} />
}

function ReviewForm({ c }: { c: AdminConcert }) {
  const nav = useNavigate()
  const qc = useQueryClient()
  const artists = useArtists().data ?? []
  const [picked, setPicked] = useState<string[]>(c.artistIds)
  const [q, setQ] = useState('')
  const [openAt, setOpenAt] = useState(toLocal(c.ticketOpenAt))
  const [busy, setBusy] = useState(false)
  const [hide, setHide] = useState(false)

  const term = q.trim().toLowerCase()
  const matches = term ? artists.filter((a) => !picked.includes(a.id)
    && [a.name, a.nameJa, a.nameEn].some((n) => n?.toLowerCase().includes(term))).slice(0, 8) : []
  const byId = (aid: string): Artist | undefined => artists.find((a) => a.id === aid)

  const done = async (msg: string) => {
    await Promise.all([qc.invalidateQueries({ queryKey: ['admin'] }), qc.invalidateQueries({ queryKey: keys.concerts })])
    toast(msg)
    nav('/admin/review', { replace: true })
  }
  const publish = async () => {
    if (!picked.length) return toast('아티스트를 한 명 이상 연결해 주세요.')
    setBusy(true)
    try {
      await api.adminPublishConcert(c.id, { artistIds: picked, ticketOpenAt: fromLocal(openAt) })
      await done('게시했어요')
    } catch (e) { toast(errorText(e)) } finally { setBusy(false) }
  }

  return (
    <div className="pb-10">
      <AppHeader back title="공연 검수" />
      <div className="flex gap-4 px-5 pt-2">
        <Poster id={c.id} url={c.posterUrl} title={c.title} className="h-[120px] w-[88px] shrink-0 rounded-[10px]" />
        <div className="min-w-0">
          <p className="t-cap text-graphite">{STATUS[c.status]}{c.kopisId ? ` · ${c.kopisId}` : ''}</p>
          <h1 className="mt-1 t-head">{c.title}</h1>
          <p className="mt-1 t-sub text-graphite num">{c.schedules.length ? fmtRange(c.schedules) : '일정 없음'}</p>
          <p className="t-sub text-graphite">{c.venue}{c.region ? ` · ${c.region}` : ''}</p>
        </div>
      </div>

      <section className="mt-6 px-5">
        <h2 className="t-sub font-semibold text-graphite">자동 판별 근거</h2>
        <p className="mt-1 t-body"><span className="font-semibold num">{c.score ?? 0}점</span> {c.reasons.join(', ') || '근거 없음 (직접 가져온 공연)'}</p>
        <dl className="mt-2 space-y-1 t-sub">
          <div className="flex gap-3"><dt className="w-14 shrink-0 text-graphite">내한</dt><dd>{c.visit == null ? '-' : c.visit ? '예' : '아니요'}</dd></div>
          <div className="flex gap-3"><dt className="w-14 shrink-0 text-graphite">출연</dt><dd>{c.cast || '-'}</dd></div>
          <div className="flex gap-3"><dt className="w-14 shrink-0 text-graphite">기획사</dt><dd>{c.promoter || '-'}</dd></div>
        </dl>
      </section>

      <section className="mt-6 px-5">
        <div className="flex items-center justify-between">
          <h2 className="t-sub font-semibold text-graphite">연결할 아티스트</h2>
          <Link to="/admin/artists/new" className="flex h-9 items-center t-sub font-semibold">새 아티스트</Link>
        </div>
        <ul className="mt-1 flex flex-wrap gap-2">
          {picked.map((aid) => (
            <li key={aid}>
              <button onClick={() => setPicked(picked.filter((x) => x !== aid))} aria-label={`${byId(aid)?.name ?? aid} 빼기`}
                className="flex h-9 items-center gap-1 rounded-full bg-ink pl-3.5 pr-2.5 t-sub font-semibold text-paper">
                {byId(aid)?.name ?? '알 수 없음'}<IconClose size={14} />
              </button>
            </li>
          ))}
          {!picked.length && <li className="t-sub text-graphite">아직 없어요</li>}
        </ul>
        <SearchField className="mt-3" value={q} onValue={setQ} placeholder="아티스트 이름 (한·일·영)" label="연결할 아티스트 검색" />
        {matches.length > 0 && (
          <ul className="mt-1">
            {matches.map((a) => (
              <li key={a.id}>
                <button onClick={() => { setPicked([...picked, a.id]); setQ('') }} className="flex min-h-11 w-full items-center gap-2 text-left t-body active:bg-mist">
                  {a.name}<span className="truncate t-sub text-graphite">{[a.nameJa, a.nameEn].filter(Boolean).join(' · ')}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {term && !matches.length && <p className="mt-2 t-sub text-graphite">찾는 아티스트가 없으면 '새 아티스트'로 추가하세요.</p>}
      </section>

      <section className="mt-6 px-5">
        <label className="block">
          <span className="t-sub font-semibold text-graphite">예매 오픈 일시 (한국 시간)</span>
          <input type="datetime-local" value={openAt} onChange={(e) => setOpenAt(e.target.value)}
            className="mt-1 block h-11 w-full border-b border-hairline outline-none focus:border-ink t-body num" />
        </label>
      </section>

      <div className="mt-8 flex gap-2 px-5">
        <Button variant="secondary" className="flex-1" disabled={busy || c.status === 'hidden'} onClick={() => setHide(true)}>숨김</Button>
        <Button className="flex-[2]" disabled={busy} onClick={publish}>{c.status === 'published' ? '변경 저장' : '게시'}</Button>
      </div>

      <Confirm open={hide} title="이 공연을 숨길까요?" message="숨긴 공연은 다음 수집 때도 다시 나타나지 않아요."
        confirmLabel="숨김" danger onClose={() => setHide(false)}
        onConfirm={async () => {
          setHide(false)
          try { await api.adminHideConcert(c.id); await done('숨겼어요') } catch (e) { toast(errorText(e)) }
        }} />
    </div>
  )
}
