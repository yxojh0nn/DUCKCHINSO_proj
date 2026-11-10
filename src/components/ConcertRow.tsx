import { Link } from 'react-router-dom'
import type { Concert } from '@/api'
import { fmtRange } from '@/lib/date'
import { IconTicket } from './icons'
import { Poster } from './Poster'

// 공연 목록 한 줄: 포스터, 제목, 날짜, 장소. 누르면 공연 상세. right: 줄 끝 동작 버튼(선택)
export function ConcertRow({ concert, favorite, right }: { concert: Concert; favorite?: boolean; right?: React.ReactNode }) {
  return (
    <li className="flex items-center">
      <Link to={`/concert/${concert.id}`} className="flex min-w-0 flex-1 gap-3.5 px-5 py-3 active:bg-mist">
        <Poster id={concert.id} url={concert.posterUrl} title={concert.title} className="h-[76px] w-[56px] shrink-0 rounded-[8px]" />
        <div className="min-w-0 flex-1 py-0.5">
          <p className="line-clamp-2 t-body font-semibold">{concert.title}</p>
          <p className="mt-1 t-sub text-graphite num">{fmtRange(concert.schedules)}</p>
          <p className="truncate t-sub text-graphite">{concert.venue}</p>
        </div>
        {favorite && <><IconTicket size={18} filled className="mt-1 shrink-0" /><span className="sr-only">관심 공연</span></>}
      </Link>
      {right && <div className="shrink-0 pr-3">{right}</div>}
    </li>
  )
}
