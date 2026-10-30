import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { CONCERTS } from '@/data/mock'
import { kstDayKey } from '@/lib/date'
import { useAppStore } from '@/store/useAppStore'
import { AppHeader } from '@/components/AppHeader'
import { ConcertRow } from '@/components/ConcertCard'
import { Segmented } from '@/components/ui/Segmented'
import { Button } from '@/components/ui/Button'

// 홈: 상단 캘린더 + 아래 공연 목록 (기획서 5.2)
export default function Home() {
  const nav = useNavigate()
  const cal = useRef<FullCalendar>(null)
  const myArtists = useAppStore((s) => s.myArtists)
  const now = useAppStore((s) => s.now)()
  const [scope, setScope] = useState<'mine' | 'all'>(myArtists.length ? 'mine' : 'all')
  const [day, setDay] = useState<string | null>(null)
  const [month, setMonth] = useState('')

  const today = kstDayKey(now)
  const isMine = (artistIds: string[]) => artistIds.some((id) => myArtists.includes(id))
  const concerts = CONCERTS
    .filter((c) => scope === 'all' || isMine(c.artistIds))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  const list = day
    ? concerts.filter((c) => kstDayKey(c.startsAt) === day)
    : concerts.filter((c) => new Date(c.startsAt).getTime() >= now)

  // 날짜별 점: 공연일(rose), 예매 오픈일(azure)
  const shows = new Set(concerts.map((c) => kstDayKey(c.startsAt)))
  const opens = new Set(concerts.map((c) => kstDayKey(c.ticketOpenAt)))
  const api = () => cal.current?.getApi()

  return (
    <>
      <AppHeader title="공연 캘린더" large />

      <section aria-label="월간 캘린더" className="px-3">
        <div className="flex items-center justify-between px-2 pb-3">
          <p className="t-title num">{month}</p>
          <div className="flex">
            <button aria-label="이전 달" onClick={() => api()?.prev()} className="flex h-11 w-11 items-center justify-center text-ink active:opacity-50">
              <svg aria-hidden viewBox="0 0 10 16" className="h-4 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2L2 8l6 6" /></svg>
            </button>
            <button aria-label="다음 달" onClick={() => api()?.next()} className="flex h-11 w-11 items-center justify-center text-ink active:opacity-50">
              <svg aria-hidden viewBox="0 0 10 16" className="h-4 w-2.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 2l6 6-6 6" /></svg>
            </button>
          </div>
        </div>
        <FullCalendar
          ref={cal}
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          initialDate={today}
          locale="ko"
          timeZone="Asia/Seoul"
          height="auto"
          fixedWeekCount={false}
          headerToolbar={false}
          datesSet={(arg) => {
            const mid = new Date((arg.start.getTime() + arg.end.getTime()) / 2)
            setMonth(`${mid.getUTCFullYear()}년 ${mid.getUTCMonth() + 1}월`)
          }}
          dayCellContent={(arg) => {
            const key = arg.date.toISOString().slice(0, 10)
            const selected = key === day
            const isToday = key === today
            return (
              <span className="flex flex-col items-center gap-1">
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-full text-[17px] num ${
                    selected ? (isToday ? 'bg-rose font-semibold text-paper' : 'bg-ink font-semibold text-paper') : isToday ? 'font-semibold text-rose' : 'text-ink'
                  }`}
                >
                  {arg.date.getUTCDate()}
                </span>
                <span className="flex h-1.5 gap-1">
                  {shows.has(key) && <i className="h-1.5 w-1.5 rounded-full bg-rose" />}
                  {opens.has(key) && <i className="h-1.5 w-1.5 rounded-full bg-azure" />}
                </span>
              </span>
            )
          }}
          dateClick={(arg) => setDay(day === arg.dateStr ? null : arg.dateStr)}
        />
        <p className="flex gap-4 px-2 pt-1 t-cap text-graphite">
          <span className="flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-rose" />공연</span>
          <span className="flex items-center gap-1.5"><i className="h-1.5 w-1.5 rounded-full bg-azure" />예매 오픈</span>
        </p>
      </section>

      <section aria-label="공연 목록" className="mt-6 flex-1 border-t border-hairline/70">
        <div className="px-5 pt-4">
          <Segmented
            label="공연 범위"
            value={scope}
            onChange={setScope}
            options={[
              { value: 'mine', label: '관심 아티스트', disabled: !myArtists.length },
              { value: 'all', label: '전체 J-pop' },
            ]}
          />
          <div className="mt-5 flex items-baseline justify-between">
            <h2 className="t-title">{day ? `${Number(day.slice(5, 7))}월 ${Number(day.slice(8))}일` : '다가오는 공연'}</h2>
            {day && <Button variant="plain" size="sm" onClick={() => setDay(null)}>전체 일정</Button>}
          </div>
        </div>

        {!myArtists.length && (
          <p className="px-5 pt-2 t-sub text-graphite">
            관심 아티스트를 고르면 그 공연만 모아 볼 수 있어요.{' '}
            <button className="text-azure" onClick={() => nav('/me/artists')}>아티스트 고르기</button>
          </p>
        )}

        <ul className="mt-2">
          {list.map((c) => <ConcertRow key={c.id} concert={c} mine={isMine(c.artistIds)} now={now} />)}
        </ul>
        {list.length === 0 && (
          <p className="px-5 py-10 t-body text-graphite">{day ? '이날은 공연이 없어요. 점이 있는 날짜를 눌러 보세요.' : '예정된 공연이 없어요.'}</p>
        )}
        <p className="px-5 pb-8 pt-6 t-cap text-graphite">프로토타입 샘플 데이터이며 실제 공연 정보가 아니에요.</p>
      </section>
    </>
  )
}
