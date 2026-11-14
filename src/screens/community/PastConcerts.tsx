import { useState } from 'react'
import { ConcertRow } from '@/components/ConcertRow'
import { LoadMore } from '@/components/LoadMore'
import { Empty } from '@/components/ui/Empty'
import { isPastConcert, lastShow } from '@/lib/date'
import { useArtists, useConcerts } from '@/lib/queries'

const PAGE = 30

// 커뮤니티 > 공연 후기: 지난 공연을 가장 최근에 끝난 순으로. 검색어는 공연명·공연장·출연 아티스트에서 찾는다
// 공연을 누르면 공연 상세 → "후기 남기기"
export function PastConcerts({ q }: { q: string }) {
  const concerts = useConcerts()
  const artists = useArtists().data ?? []
  const [limit, setLimit] = useState(PAGE)
  const s = q.trim().toLowerCase()
  const name = new Map(artists.map((a) => [a.id, [a.name, a.nameJa, a.nameEn].filter(Boolean).join(' ')]))
  const past = (concerts.data ?? [])
    .filter(isPastConcert)
    .filter((c) => !s || `${c.title} ${c.venue} ${c.artistIds.map((a) => name.get(a)).join(' ')}`.toLowerCase().includes(s))
    .sort((a, b) => lastShow(b).localeCompare(lastShow(a)))

  if (!past.length) return <Empty title={concerts.isLoading ? '불러오는 중…' : s ? '맞는 지난 공연이 없어요' : '아직 지난 공연이 없어요'} />
  return (
    <>
      <ul className="pb-2">{past.slice(0, limit).map((c) => <ConcertRow key={c.id} concert={c} />)}</ul>
      {past.length > limit && <LoadMore key={limit} onMore={() => setLimit(limit + PAGE)} />}
    </>
  )
}
