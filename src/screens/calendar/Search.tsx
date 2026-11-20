import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ConcertRow } from '@/components/ConcertRow'
import { IconBack, IconSearch } from '@/components/icons'
import { SearchField } from '@/components/ui/Field'
import { Chip } from '@/components/ui/Button'
import { Empty } from '@/components/ui/Empty'
import { DAY_MS, kstDayKey } from '@/lib/date'
import { useArtists, useConcerts, useGenres, useMe } from '@/lib/queries'

const PRICES = [
  { id: 'p1', label: '5만원 이하', max: 50000 },
  { id: 'p2', label: '5~10만원', min: 50000, max: 100000 },
  { id: 'p3', label: '10~15만원', min: 100000, max: 150000 },
  { id: 'p4', label: '15만원 이상', min: 150000 },
]
const DATES = [
  { id: 'week', label: '7일 이내', days: 7 },
  { id: 'month', label: '30일 이내', days: 30 },
  { id: 'quarter', label: '3개월 이내', days: 92 },
]


// 공연 검색: 키워드 + 장르·가격·날짜·관심 공연 범주
export default function Search() {
  const nav = useNavigate()
  const concerts = useConcerts().data ?? []
  const artists = useArtists().data // 불러오기 전 undefined → 불러온 뒤 한 번만 Map 을 만든다
  const genres = useGenres().data ?? []
  const favs = useMe().data?.favoriteIds ?? []
  const [q, setQ] = useState('')
  const [genre, setGenre] = useState<number | null>(null)
  const [price, setPrice] = useState<string | null>(null)
  const [date, setDate] = useState<string | null>(null)
  const [favOnly, setFavOnly] = useState(false)

  const names = useMemo(() => new Map((artists ?? []).map((a) => [a.id, [a.name, a.nameJa, a.nameEn].filter(Boolean).join(' ')])), [artists])
  const today = kstDayKey(Date.now())
  const active = !!(q.trim() || genre || price || date || favOnly)

  const results = concerts.filter((c) => {
    const s = q.trim().toLowerCase()
    if (s && !`${c.title} ${c.venue} ${c.region ?? ''} ${c.artistIds.map((a) => names.get(a)).join(' ')}`.toLowerCase().includes(s)) return false
    if (genre && !c.genreIds.includes(genre)) return false
    if (favOnly && !favs.includes(c.id)) return false
    if (price) {
      const p = PRICES.find((x) => x.id === price)!
      if (c.priceMin == null) return false
      if (p.min != null && (c.priceMax ?? c.priceMin) < p.min) return false
      if (p.max != null && c.priceMin > p.max) return false
    }
    const days = c.schedules.map(kstDayKey)
    if (!days.some((d) => d >= today)) return false
    if (date) {
      const until = kstDayKey(Date.now() + DATES.find((x) => x.id === date)!.days * DAY_MS)
      if (!days.some((d) => d >= today && d <= until)) return false
    }
    return true
  })
    // 캘린더 목록과 같은 순서: 오늘 이후 가장 가까운 공연일 순
    .map((c) => ({ c, next: c.schedules.map(kstDayKey).find((d) => d >= today) ?? '' }))
    .sort((a, b) => a.next.localeCompare(b.next))
    .map((x) => x.c)

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-20 bg-paper pt-[env(safe-area-inset-top)]">
        <div className="flex items-center gap-1 pl-1 pr-4">
          <button aria-label="뒤로" onClick={() => nav(-1)} className="flex h-11 w-11 items-center justify-center"><IconBack /></button>
          <SearchField className="flex-1" autoFocus clearable value={q} onValue={setQ} placeholder="공연, 아티스트, 공연장" label="공연 검색어" />
        </div>
        <div className="space-y-2 pb-3 pt-3">
          {[
            { title: '장르', body: genres.map((g) => <Chip key={g.id} on={genre === g.id} onClick={() => setGenre(genre === g.id ? null : g.id)}>{g.name}</Chip>) },
            { title: '가격', body: PRICES.map((p) => <Chip key={p.id} on={price === p.id} onClick={() => setPrice(price === p.id ? null : p.id)}>{p.label}</Chip>) },
            { title: '날짜', body: [...DATES.map((d) => <Chip key={d.id} on={date === d.id} onClick={() => setDate(date === d.id ? null : d.id)}>{d.label}</Chip>),
              <Chip key="fav" on={favOnly} onClick={() => setFavOnly(!favOnly)}>관심 공연만</Chip>] },
          ].map((row) => (
            <div key={row.title} role="group" aria-label={row.title} className="flex items-center gap-2 overflow-x-auto px-5 [scrollbar-width:none]">
              <span className="w-8 shrink-0 t-cap text-graphite">{row.title}</span>
              {row.body}
            </div>
          ))}
        </div>
      </div>
      <p className="border-t border-hairline px-5 pb-1 pt-3 t-sub text-graphite" aria-live="polite">
        {active ? `검색 결과 ${results.length}개` : '다가오는 공연 전체'}
      </p>
      {results.length ? <ul className="pb-8">{results.map((c) => <ConcertRow key={c.id} concert={c} favorite={favs.includes(c.id)} />)}</ul>
        : <Empty icon={<IconSearch size={40} />} title="맞는 공연이 없어요" body="검색어를 줄이거나 범주를 해제해 보세요." />}
    </div>
  )
}
