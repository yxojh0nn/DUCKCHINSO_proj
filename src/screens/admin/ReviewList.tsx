import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { Poster } from '@/components/Poster'
import { Empty } from '@/components/ui/Empty'
import { fmtRange } from '@/lib/date'
import { adminKeys } from './AdminGate'

// 검수 대기 공연: 자동 판별이 확신하지 못한 공연. 점수 높은 순, 근거를 함께 보여 준다
export default function ReviewList() {
  const list = useQuery({ queryKey: adminKeys.review, queryFn: () => api.adminReviewConcerts() })
  return (
    <>
      <AppHeader back title="검수 대기 공연" />
      {list.data?.length ? (
        <ul className="pb-8">
          {list.data.map((c) => (
            <li key={c.id}>
              <Link to={`/admin/concerts/${c.id}`} className="flex gap-3.5 px-5 py-3 active:bg-mist">
                <Poster id={c.id} url={c.posterUrl} title={c.title} className="h-[76px] w-[56px] shrink-0 rounded-[8px]" />
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 t-body font-semibold">{c.title}</p>
                  <p className="mt-0.5 t-sub text-graphite num">{c.schedules.length ? fmtRange(c.schedules) : '일정 없음'} · {c.venue}</p>
                  <p className="mt-1 line-clamp-2 t-cap text-graphite">
                    <span className="font-semibold text-ink num">{c.score ?? 0}점</span> {c.reasons.join(', ')}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : <Empty title={list.isLoading ? '불러오는 중…' : '검수할 공연이 없어요'} />}
    </>
  )
}
