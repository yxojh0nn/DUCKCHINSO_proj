import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, errorText } from '@/api'
import { AppHeader, HeaderButton } from '@/components/AppHeader'
import { IconExternal, IconPin, IconTicket } from '@/components/icons'
import { Poster, PosterViewer } from '@/components/Poster'
import { TicketTipSheet } from '@/components/TicketTipSheet'
import { Empty } from '@/components/ui/Empty'
import { fmtDateTime, fmtTime, fmtDay, kstDayKey, won } from '@/lib/date'
import { openGoogleMap, openKakaoMap, openTicket } from '@/lib/external'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { PostRow } from '@/components/PostRow'
import { isPastConcert } from '@/lib/date'
import { priceLines } from '@/lib/price'
import { keys, useArtists, useConcerts, useMe } from '@/lib/queries'
import { toast } from '@/store/ui'

// 정보 한 줄: 왼쪽 이름표, 오른쪽 값 (상자 없이 정렬로만 구분)
function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[72px_1fr] gap-3 py-2.5">
      <dt className="t-sub text-graphite">{label}</dt>
      <dd className="t-body">{children}</dd>
    </div>
  )
}

// 공연 상세: 포스터, 공연명, 공연일자, 예매일자, 예매처, 공연 위치, 가격
export default function ConcertDetail() {
  const { id } = useParams()
  const qc = useQueryClient()
  const concerts = useConcerts()
  const artists = useArtists().data ?? []
  const me = useMe().data
  const [tipOpen, setTipOpen] = useState(false)
  const [zoom, setZoom] = useState(false)
  const nav = useNavigate()
  const c = concerts.data?.find((x) => x.id === id)
  const past = !!c && isPastConcert(c)
  // 지난 공연의 후기 (공연 연결 글)
  const reviews = useQuery({ queryKey: keys.posts({ concertId: id }), queryFn: () => api.listPosts({ concertId: id }), enabled: past })

  if (concerts.isLoading) return <AppHeader back />
  if (!c) return (<><AppHeader back /><Empty title="공연을 찾을 수 없어요" body="보관 기간이 지나 정리됐을 수 있어요." /></>)

  const fav = !!me?.favoriteIds.includes(c.id)
  const toggleFav = async () => {
    try {
      await api.setFavorite(c.id, !fav)
      await qc.invalidateQueries({ queryKey: keys.me })
      toast(fav ? '관심 공연에서 뺐어요' : '관심 공연에 담았어요. 캘린더에 표시돼요.')
    } catch (e) { toast(errorText(e)) }
  }
  const byDay = new Map<string, string[]>()
  c.schedules.forEach((s) => byDay.set(kstDayKey(s), [...(byDay.get(kstDayKey(s)) ?? []), s]))
  const artistNames = c.artistIds.map((a) => artists.find((x) => x.id === a)?.name).filter(Boolean).join(', ')
  const opened = c.ticketOpenAt && new Date(c.ticketOpenAt).getTime() <= Date.now()

  return (
    <div className="pb-[max(24px,env(safe-area-inset-bottom))]">
      <AppHeader back right={
        <HeaderButton label={fav ? '관심 공연 해제' : '관심 공연으로 저장'} onClick={toggleFav}>
          <IconTicket filled={fav} />
        </HeaderButton>
      } />
      <div className="flex gap-4 px-5 pt-2">
        {c.posterUrl ? (
          <button onClick={() => setZoom(true)} aria-label="포스터 크게 보기" className="shrink-0 rounded-[12px] active:opacity-80">
            <Poster id={c.id} url={c.posterUrl} title={c.title} eager className="h-[168px] w-[120px] rounded-[12px]" />
          </button>
        ) : <Poster id={c.id} url={null} title={c.title} className="h-[168px] w-[120px] shrink-0 rounded-[12px]" />}
        <div className="min-w-0 flex-1 pt-1">
          {artistNames && <p className="t-sub font-semibold text-graphite">{artistNames}</p>}
          <h1 className="mt-1 t-title">{c.title}</h1>
          <button onClick={toggleFav} aria-pressed={fav} className="mt-3 flex h-9 items-center gap-1.5 t-sub font-semibold">
            <IconTicket size={18} filled={fav} />{fav ? '관심 공연' : '관심 공연에 담기'}
          </button>
        </div>
      </div>

      <dl className="mt-5 border-t border-hairline px-5 pt-1">
        <Info label="공연 일자">
          <ul className="space-y-0.5 num">
            {[...byDay].map(([d, times]) => <li key={d}>{fmtDay(times[0])} {times.map(fmtTime).join(', ')}</li>)}
          </ul>
        </Info>
        <Info label="예매 일자">
          {c.ticketOpenAt ? <span className="num">{fmtDateTime(c.ticketOpenAt)}{opened ? ' · 예매 중' : ' 오픈 예정'}</span> : <span className="text-graphite">예매 일정 미정</span>}
          {/* 회원만: 아직 열리지 않은 공연의 예매 오픈일 제보 (날짜가 없거나 바뀐 경우) */}
          {!opened && !past && me && !me.isGuest && (
            <button onClick={() => setTipOpen(true)} className="mt-1 flex h-9 items-center t-sub text-graphite underline underline-offset-4">
              {c.ticketOpenAt ? '다른 날짜를 봤어요' : '예매 오픈일 알려 주기'}
            </button>
          )}
        </Info>
        <Info label="공연 위치">
          <p>{c.venue}{c.region ? ` · ${c.region}` : ''}</p>
          <p className="mt-1 flex gap-4">
            <button onClick={() => openKakaoMap(c.venueQuery)} className="flex h-9 items-center gap-1 t-sub font-semibold"><IconPin size={16} />카카오맵</button>
            <button onClick={() => openGoogleMap(c.venueQuery)} className="flex h-9 items-center gap-1 t-sub font-semibold"><IconPin size={16} />구글 지도</button>
          </p>
        </Info>
        <Info label="가격">
          {c.priceText ? (
            <ul className="space-y-0.5">
              {priceLines(c.priceText).map((p, i) => (
                <li key={i}>{p.seat} <span className="num">{p.price}</span></li>
              ))}
            </ul>
          ) : c.priceMin ? `${won(c.priceMin)}~` : <span className="text-graphite">예매처에서 확인</span>}
        </Info>
        <Info label="예매처">{c.links.map((l) => l.vendor).join(', ') || <span className="text-graphite">미정</span>}</Info>
      </dl>

      {past ? (
        <section className="mt-6">
          <div className="px-5">
            {me?.isGuest ? <p className="t-sub text-graphite">후기는 회원만 남길 수 있어요.</p>
              : <button onClick={() => nav(`/community/write?concert=${c.id}`)} className="flex h-[52px] w-full items-center justify-center rounded-[14px] bg-ink t-head text-paper active:opacity-75">후기 남기기</button>}
          </div>
          <h2 className="px-5 pb-1 pt-6 t-sub font-semibold text-graphite">이 공연 후기 {reviews.data?.length ?? ''}</h2>
          {reviews.data?.length ? <ul>{reviews.data.map((p) => <PostRow key={p.id} post={p} />)}</ul>
            : <p className="px-5 py-4 t-sub text-graphite">{reviews.isLoading ? '불러오는 중…' : '아직 후기가 없어요. 첫 후기를 남겨 주세요.'}</p>}
        </section>
      ) : (
      <div className="mt-6 flex flex-col gap-2.5 px-5">
        {c.links.map((l, i) => (
          <button key={l.url} onClick={() => { api.logTicketClick(c.id, l.url).catch(() => {}); openTicket(l.url) }}
            className={`flex h-[52px] items-center justify-center gap-2 rounded-[14px] t-head active:opacity-75 ${i === 0 ? 'bg-ink text-paper' : 'bg-mist'}`}>
            {l.vendor}에서 예매하기<IconExternal size={18} />
          </button>
        ))}
      </div>
      )}
      <TicketTipSheet open={tipOpen} onClose={() => setTipOpen(false)} concertId={c.id} />
      {zoom && c.posterUrl && <PosterViewer url={c.posterUrl} title={c.title} intro={c.introUrls} onClose={() => setZoom(false)} />}
    </div>
  )
}
