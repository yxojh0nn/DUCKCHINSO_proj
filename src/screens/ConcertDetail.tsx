import { useNavigate, useParams } from 'react-router-dom'
import { ARTISTS, CONCERTS } from '@/data/mock'
import { fmtDateTime } from '@/lib/date'
import { openGoogleMap, openKakaoMap, openTicket } from '@/lib/external'
import { useAppStore } from '@/store/useAppStore'
import { AppHeader } from '@/components/AppHeader'
import { InfoRow } from '@/components/InfoRow'
import { Button } from '@/components/ui/Button'
import { Tag } from '@/components/ui/Chip'

// 공연 상세: 일시·예매 오픈·장소·예매처 4가지만 (기획서 5.2)
export default function ConcertDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const now = useAppStore((s) => s.now)()
  const c = CONCERTS.find((x) => x.id === id)
  if (!c) return <><AppHeader title="공연" back /><p className="p-8 text-center text-sm text-muted">공연을 찾을 수 없어요</p></>

  const artists = c.artistIds.map((aid) => ARTISTS.find((a) => a.id === aid)).filter((a) => !!a)
  const opened = new Date(c.ticketOpenAt).getTime() <= now

  return (
    <>
      <AppHeader title="공연 상세" back />
      <div className="flex-1 px-4 py-5">
        <div className="mb-1 flex flex-wrap gap-1">
          {artists.map((a) => <Tag key={a.id} tone="accent">{a.name}</Tag>)}
        </div>
        <h1 className="mb-4 text-xl font-bold leading-snug">{c.title}</h1>

        <dl className="rounded-2xl border border-line bg-surface px-4">
          <InfoRow label="공연 일시">{fmtDateTime(c.startsAt)}</InfoRow>
          <InfoRow label="예매 오픈">
            {fmtDateTime(c.ticketOpenAt)} {opened ? <Tag>오픈됨</Tag> : <Tag tone="sys">오픈 예정</Tag>}
          </InfoRow>
          <InfoRow label="공연 장소">
            <span className="block">{c.venue}</span>
            <span className="mt-2 flex gap-1.5">
              <Button variant="secondary" className="!px-3 !py-1.5 !text-xs" onClick={() => openKakaoMap(c.venueQuery)}>카카오맵 길찾기</Button>
              <Button variant="secondary" className="!px-3 !py-1.5 !text-xs" onClick={() => openGoogleMap(c.venueQuery)}>구글맵 길찾기</Button>
            </span>
          </InfoRow>
          <InfoRow label="예매처">
            <span className="flex flex-col gap-1.5">
              {c.ticketLinks.map((t) => (
                <Button key={t.vendor} className="!justify-between" onClick={() => openTicket(t.url)}>
                  {t.vendor}에서 예매 <span aria-hidden>↗</span>
                </Button>
              ))}
            </span>
          </InfoRow>
        </dl>
        <p className="mt-2 text-[11px] text-muted">예매는 외부 브라우저, 길찾기는 지도 앱으로 열려요. 가격·좌석은 예매처에서 확인해 주세요.</p>

        <button
          onClick={() => nav(`/match?artist=${c.artistIds[0]}`)}
          className="mt-6 flex w-full items-center gap-3 rounded-2xl bg-user-soft p-4 text-left text-user"
        >
          <span className="text-2xl" aria-hidden>👥</span>
          <span className="flex-1">
            <span className="block text-sm font-bold">이 아티스트 좋아하는 사람 보기</span>
            <span className="block text-xs opacity-80">취향이 겹치는 사람에게 대화를 요청해 보세요</span>
          </span>
          <span aria-hidden>›</span>
        </button>
      </div>
    </>
  )
}
