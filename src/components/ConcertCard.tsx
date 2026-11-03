import { Link } from 'react-router-dom'
import { ARTISTS, type Concert } from '@/data/mock'

type Props = { concert: Concert; mine: boolean; now: number }

const part = (iso: string, opt: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', ...opt }).format(new Date(iso))

// 공연 목록 한 줄: 왼쪽에 큰 날짜 숫자, 오른쪽에 공연명·장소
export function ConcertRow({ concert, mine, now }: Props) {
  const names = concert.artistIds.map((id) => ARTISTS.find((a) => a.id === id)?.name).filter(Boolean).join(', ')
  const openSoon = new Date(concert.ticketOpenAt).getTime() > now
  return (
    <li className="group relative">
      <Link to={`/concert/${concert.id}`} className="flex items-start gap-4 px-5 py-3.5 active:bg-mist">
        <span className="w-9 shrink-0 text-center">
          <span className="block text-[28px] font-light leading-7 tracking-[-0.03em] num">{part(concert.startsAt, { day: 'numeric' }).replace('일', '')}</span>
          <span className="mt-1 block t-cap text-graphite">{part(concert.startsAt, { weekday: 'short' })}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            {mine && <span aria-label="관심 아티스트" className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose" />}
            <span className="truncate t-head">{concert.title}</span>
          </span>
          <span className="mt-0.5 block truncate t-sub text-graphite">{names}</span>
          <span className="block truncate t-sub text-graphite">
            {concert.venue}, <span className="num">{part(concert.startsAt, { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
          </span>
          {openSoon && (
            <span className="mt-1 block t-sub text-azure">
              {part(concert.ticketOpenAt, { month: 'long', day: 'numeric' })} 예매 오픈
            </span>
          )}
        </span>
      </Link>
      <span aria-hidden className="absolute bottom-0 left-[72px] right-0 h-px bg-hairline/70 group-last:hidden" />
    </li>
  )
}
