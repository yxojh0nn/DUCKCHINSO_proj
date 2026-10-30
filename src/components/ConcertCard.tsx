import { Link } from 'react-router-dom'
import { ARTISTS, type Concert } from '@/data/mock'
import { fmtShort } from '@/lib/date'
import { Tag } from './ui/Chip'

type Props = { concert: Concert; mine: boolean; now: number }

export function ConcertCard({ concert, mine, now }: Props) {
  const names = concert.artistIds.map((id) => ARTISTS.find((a) => a.id === id)?.name).filter(Boolean).join(', ')
  const openSoon = new Date(concert.ticketOpenAt).getTime() > now
  return (
    <Link to={`/concert/${concert.id}`} className="flex gap-3 rounded-2xl border border-line bg-surface p-3 transition hover:border-accent">
      <div className="flex w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-accent-soft text-accent">
        <span className="text-[11px]">{new Date(concert.startsAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'short' })}</span>
        <span className="text-lg font-bold leading-tight">{new Date(concert.startsAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', day: 'numeric' }).replace('일', '')}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex flex-wrap gap-1">
          {mine && <Tag tone="accent">관심</Tag>}
          {openSoon && <Tag tone="sys">예매 오픈 예정</Tag>}
        </div>
        <p className="truncate text-sm font-bold">{concert.title}</p>
        <p className="truncate text-xs text-muted">{names} · {concert.venue} · {fmtShort(concert.startsAt)}</p>
      </div>
    </Link>
  )
}
