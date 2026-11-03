import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppHeader, HeaderButton } from '@/components/AppHeader'
import { ConcertRow } from '@/components/ConcertRow'
import { MonthCalendar } from '@/components/MonthCalendar'
import { IconBack, IconChevron, IconSearch, IconViewMarks, IconViewNames } from '@/components/icons'
import { Empty } from '@/components/ui/Empty'
import { TextTabs } from '@/components/ui/TextTabs'
import { kstDayKey } from '@/lib/date'
import { useArtists, useConcerts, useMe } from '@/lib/queries'
import { useUI } from '@/store/ui'

// 공연·캘린더 탭 (인앱 상세 기획)
export default function CalendarScreen() {
  const nav = useNavigate()
  const me = useMe().data
  const concerts = useConcerts()
  const artists = useArtists().data ?? []
  const { calMode, setCalMode } = useUI()
  const today = kstDayKey(Date.now())
  const [ym, setYm] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) }))
  const [day, setDay] = useState<string | null>(null)
  const [scope, setScope] = useState<'all' | 'mine'>('all')

  const artistName = useMemo(() => {
    const map = new Map(artists.map((a) => [a.id, a.nameEn && /^[\x20-\x7e]+$/.test(a.nameEn) && a.nameEn.length <= 8 ? a.nameEn : a.name]))
    return (id: string) => map.get(id) ?? ''
  }, [artists])

  const mine = me?.artistIds ?? []
  const favs = me?.favoriteIds ?? []
  const list = (concerts.data ?? []).filter((c) => scope === 'all' || c.artistIds.some((a) => mine.includes(a)) || favs.includes(c.id))
  const shown = day
    ? list.filter((c) => c.schedules.some((s) => kstDayKey(s) === day))
    : list.filter((c) => c.schedules.some((s) => kstDayKey(s) >= today))
        .sort((a, b) => (a.schedules.find((s) => kstDayKey(s) >= today) ?? '').localeCompare(b.schedules.find((s) => kstDayKey(s) >= today) ?? ''))

  const move = (d: number) => {
    const t = new Date(Date.UTC(ym.y, ym.m - 1 + d, 1))
    setYm({ y: t.getUTCFullYear(), m: t.getUTCMonth() + 1 })
    setDay(null)
  }

  return (
    <>
      <AppHeader large title="공연" right={
        <>
          <HeaderButton label={calMode === 'marks' ? '아티스트 이름으로 보기' : '점과 선으로 보기'} onClick={() => setCalMode(calMode === 'marks' ? 'names' : 'marks')}>
            {calMode === 'marks' ? <IconViewNames /> : <IconViewMarks />}
          </HeaderButton>
          <HeaderButton label="공연 검색" onClick={() => nav('/search')}><IconSearch /></HeaderButton>
        </>
      } />

      <section aria-label="월간 캘린더" className="px-2">
        <div className="flex items-center justify-between px-3 pb-2">
          <h2 className="t-title num" aria-live="polite">{ym.y}년 {ym.m}월</h2>
          <div className="flex items-center">
            {(ym.y !== Number(today.slice(0, 4)) || ym.m !== Number(today.slice(5, 7))) && (
              <button onClick={() => { setYm({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) }); setDay(today) }}
                className="h-11 px-2 t-sub font-semibold">오늘</button>
            )}
            <button aria-label="이전 달" onClick={() => move(-1)} className="flex h-11 w-11 items-center justify-center active:opacity-50"><IconBack size={20} /></button>
            <button aria-label="다음 달" onClick={() => move(1)} className="flex h-11 w-11 items-center justify-center active:opacity-50"><IconChevron size={20} /></button>
          </div>
        </div>
        <MonthCalendar year={ym.y} month={ym.m} concerts={list} favoriteIds={favs} selected={day} today={today}
          mode={calMode} artistName={artistName} onSelect={(d) => setDay(d === day ? null : d)} />
      </section>

      <section aria-label="공연 목록" className="mt-5 flex-1 border-t border-hairline pb-6">
        <div className="flex items-center justify-between pr-3 pt-1">
          <TextTabs label="공연 범위" value={scope} onChange={setScope} tabs={[{ value: 'all', label: '전체' }, { value: 'mine', label: '내 아티스트' }]} />
        </div>
        <h3 className="px-5 pb-1 pt-3 t-sub font-semibold text-graphite">
          {day ? `${Number(day.slice(5, 7))}월 ${Number(day.slice(8))}일 공연` : '다가오는 공연'}
        </h3>
        {concerts.isLoading ? <p className="px-5 py-8 t-sub text-graphite">공연을 불러오는 중…</p>
          : shown.length ? <ul>{shown.map((c) => <ConcertRow key={c.id} concert={c} favorite={favs.includes(c.id)} />)}</ul>
            : <Empty title={day ? '이날은 공연이 없어요' : '예정된 공연이 없어요'}
                body={scope === 'mine' ? '관심 아티스트와 관심 공연이 여기에 모여요.' : undefined} />}
        {/* KOPIS 이용 조건: 출처 표시 */}
        <p className="px-5 pt-4 t-cap text-graphite">공연 정보 일부 출처: (재)예술경영지원센터 공연예술통합전산망(KOPIS)</p>
      </section>
    </>
  )
}
