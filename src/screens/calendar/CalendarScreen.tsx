import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppHeader, HeaderButton } from '@/components/AppHeader'
import { ConcertRow } from '@/components/ConcertRow'
import { MonthCalendar } from '@/components/MonthCalendar'
import { IconBack, IconCalendar, IconChevron, IconSearch, IconViewMarks, IconViewNames } from '@/components/icons'
import { Empty } from '@/components/ui/Empty'
import { Segmented } from '@/components/ui/Segmented'
import { TextTabs } from '@/components/ui/TextTabs'
import { focusDay, kstDayKey, lastPlayed } from '@/lib/date'
import { useArtists, useAttendance, useConcerts, useDailyPhotos, useMe, useMembership } from '@/lib/queries'
import type { DailyPhoto } from '@/api'
import { DailyPhotoBlock, ReviewList, ReviewMonth } from './ReviewCalendar'
import { useUI } from '@/store/ui'

// 공연·캘린더 탭 (인앱 상세 기획)
export default function CalendarScreen() {
  const nav = useNavigate()
  const me = useMe().data
  const { m } = useMembership()
  const concerts = useConcerts()
  const artists = useArtists().data // 불러오기 전 undefined → 불러온 뒤 한 번만 Map 을 만든다
  const { calMode, setCalMode } = useUI()
  const today = kstDayKey(Date.now())
  const [ym, setYm] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) }))
  const [day, setDay] = useState<string | null>(null)
  const [scope, setScope] = useState<'all' | 'mine' | 'past'>('all')
  const [view, setView] = useState<'concerts' | 'reviews'>('concerts') // 공연 캘린더 / 덕질 캘린더 (다녀온 공연 + 날마다 사진)
  const attendance = useAttendance().data
  const daily = useDailyPhotos().data
  const photos = useMemo(() => {
    const m = new Map<string, DailyPhoto[]>()
    ;(daily ?? []).forEach((p) => m.set(p.day, [...(m.get(p.day) ?? []), p]))
    return m
  }, [daily])

  const artistName = useMemo(() => {
    const map = new Map((artists ?? []).map((a) => [a.id, a.nameEn && /^[\x20-\x7e]+$/.test(a.nameEn) && a.nameEn.length <= 8 ? a.nameEn : a.name]))
    return (id: string) => map.get(id) ?? ''
  }, [artists])

  // 멤버십이 끝나 한도를 넘게 담겨 있으면 먼저 담은 한도만큼만 '내 아티스트'로 본다
  const mine = (me?.artistIds ?? []).slice(0, m.maxArtists)
  const favs = me?.favoriteIds ?? []
  const now = Date.now()
  const list = (concerts.data ?? []).filter((c) => scope === 'all' || (scope === 'past' ? !!lastPlayed(c, now) : c.artistIds.some((a) => mine.includes(a)) || favs.includes(c.id)))
  // 지난 공연 탭은 목록만 거르고 캘린더에는 전체 일정을 그대로 둔다
  const calConcerts = scope === 'past' ? (concerts.data ?? []) : list
  // 이번 달: 다가오는 공연 / 다른 달(지난 달 포함): 그 달 공연 전체 / 날짜를 누르면: 그날 공연
  const ymKey = `${ym.y}-${String(ym.m).padStart(2, '0')}`
  const thisMonth = ymKey === today.slice(0, 7)
  // 지난 공연: 날짜를 고르지 않으면 달과 상관없이 지금 이전에 열린 공연 전부, 최근 회차 순
  const shown = day
    ? list.filter((c) => c.schedules.some((s) => kstDayKey(s) === day))
    : scope === 'past' ? [...list].sort((a, b) => lastPlayed(b, now).localeCompare(lastPlayed(a, now)))
    : thisMonth
      ? list.filter((c) => c.schedules.some((s) => kstDayKey(s) >= today))
          .sort((a, b) => (a.schedules.find((s) => kstDayKey(s) >= today) ?? '').localeCompare(b.schedules.find((s) => kstDayKey(s) >= today) ?? ''))
      : list.filter((c) => c.schedules.some((s) => kstDayKey(s).startsWith(ymKey)))
          .sort((a, b) => (a.schedules.find((s) => kstDayKey(s).startsWith(ymKey)) ?? '').localeCompare(b.schedules.find((s) => kstDayKey(s).startsWith(ymKey)) ?? ''))

  // 덕질 캘린더: 다녀온 기록 + 공연 정보 (보관 기간이 지나 정리된 공연은 이름 없이)
  const records = (attendance ?? []).map((a) => ({ ...a, concert: concerts.data?.find((c) => c.id === a.concertId) }))
  const recShown = records.filter((r) => (day ? r.day === day : r.day.startsWith(ymKey)))

  const calRef = useRef<HTMLElement>(null)
  // 목록의 공연 → 그 공연 날짜가 있는 달로 가서 그날을 고르고 캘린더를 보여 준다
  const jumpTo = (c: { schedules: string[] }) => {
    const d = scope === 'past' ? kstDayKey(lastPlayed(c, now)) : focusDay(c, today)
    setYm({ y: Number(d.slice(0, 4)), m: Number(d.slice(5, 7)) })
    setDay(d)
    calRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }

  const move = (d: number) => {
    const t = new Date(Date.UTC(ym.y, ym.m - 1 + d, 1))
    setYm({ y: t.getUTCFullYear(), m: t.getUTCMonth() + 1 })
    setDay(null)
  }

  return (
    <>
      <AppHeader large title="공연" right={
        <>
          {view === 'concerts' && (
            <HeaderButton label={calMode === 'marks' ? '아티스트 이름으로 보기' : '점과 선으로 보기'} onClick={() => setCalMode(calMode === 'marks' ? 'names' : 'marks')}>
              {calMode === 'marks' ? <IconViewNames /> : <IconViewMarks />}
            </HeaderButton>
          )}
          <HeaderButton label="공연 검색" onClick={() => nav('/search')}><IconSearch /></HeaderButton>
        </>
      } />
      <div className="px-5 pb-3">
        <Segmented label="캘린더 종류" value={view} onChange={(v) => { setView(v); setDay(null) }}
          options={[{ value: 'concerts', label: '공연 캘린더' }, { value: 'reviews', label: '덕질 캘린더' }]} />
      </div>

      <section ref={calRef} aria-label="월간 캘린더" className="scroll-mt-2 px-2">
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
        {view === 'concerts'
          ? <MonthCalendar year={ym.y} month={ym.m} concerts={calConcerts} favoriteIds={favs} selected={day} today={today}
              mode={calMode} artistName={artistName} onSelect={(d) => setDay(d === day ? null : d)} />
          : <ReviewMonth year={ym.y} month={ym.m} records={records} photos={photos} selected={day} today={today} onSelect={(d) => setDay(d === day ? null : d)} />}
        {/* 색은 분류가 아니라 공연 구분용이라 범례 대신 읽는 법 한 줄 */}
      </section>

      {view === 'reviews' ? (
        <section aria-label="다녀온 공연" className="mt-5 flex-1 border-t border-hairline pb-6">
          {me?.isGuest ? <Empty title="덕질 캘린더는 회원만 쓸 수 있어요" body="회원으로 로그인하면 다녀온 공연과 날마다 사진을 기록할 수 있어요." />
            : <>
                {day && day <= today && <DailyPhotoBlock day={day} photos={photos.get(day) ?? []} />}
                <ReviewList records={recShown} title={day ? `${Number(day.slice(5, 7))}월 ${Number(day.slice(8))}일 다녀온 공연` : `${ym.m}월에 다녀온 공연 ${recShown.length}개`} />
              </>}
        </section>
      ) : (
      <section aria-label="공연 목록" className="mt-5 flex-1 border-t border-hairline pb-6">
        <div className="flex items-center justify-between pr-3 pt-1">
          <TextTabs label="공연 범위" value={scope} onChange={setScope} tabs={[{ value: 'all', label: '전체' }, { value: 'mine', label: '내 아티스트' }, { value: 'past', label: '지난 공연' }]} />
        </div>
        <h3 className="px-5 pb-1 pt-3 t-sub font-semibold text-graphite">
          {day ? `${Number(day.slice(5, 7))}월 ${Number(day.slice(8))}일 공연` : scope === 'past' ? `지난 공연 ${shown.length}개` : thisMonth ? '다가오는 공연' : `${ym.m}월 공연`}
        </h3>
        {concerts.isLoading ? <p className="px-5 py-8 t-sub text-graphite">공연을 불러오는 중…</p>
          : shown.length ? <ul>{shown.map((c) => <ConcertRow key={c.id} concert={c} favorite={favs.includes(c.id)}
                right={<button aria-label={`${c.title} 캘린더에서 보기`} onClick={() => jumpTo(c)}
                  className="flex h-11 w-11 items-center justify-center text-graphite active:opacity-50"><IconCalendar size={20} /></button>} />)}</ul>
            : <Empty title={day ? '이날은 공연이 없어요' : scope === 'past' ? '지난 공연이 없어요' : thisMonth ? '예정된 공연이 없어요' : '이 달에는 공연이 없어요'}
                body={scope === 'mine' ? '관심 아티스트와 관심 공연이 여기에 모여요.' : undefined} />}
        {/* KOPIS 이용 조건: 출처 표시 */}
        <p className="px-5 pt-4 t-cap text-graphite">공연 정보 일부 출처: (재)예술경영지원센터 공연예술통합전산망(KOPIS)</p>
      </section>
      )}
    </>
  )
}
