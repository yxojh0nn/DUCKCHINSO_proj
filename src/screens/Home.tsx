import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import { CONCERTS } from '@/data/mock'
import { kstDayKey } from '@/lib/date'
import { useAppStore } from '@/store/useAppStore'
import { AppHeader } from '@/components/AppHeader'
import { ConcertCard } from '@/components/ConcertCard'
import { Chip } from '@/components/ui/Chip'

// 홈: 상단 캘린더 + 아래 공연 목록 (기획서 5.2)
export default function Home() {
  const nav = useNavigate()
  const myArtists = useAppStore((s) => s.myArtists)
  const now = useAppStore((s) => s.now)()
  const [onlyMine, setOnlyMine] = useState(myArtists.length > 0)
  const [day, setDay] = useState<string | null>(null)

  const isMine = (artistIds: string[]) => artistIds.some((id) => myArtists.includes(id))
  const concerts = CONCERTS
    .filter((c) => !onlyMine || isMine(c.artistIds))
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
  const list = day
    ? concerts.filter((c) => kstDayKey(c.startsAt) === day)
    : concerts.filter((c) => new Date(c.startsAt).getTime() >= now)

  const events = concerts.flatMap((c) => [
    { id: c.id, title: c.title, start: kstDayKey(c.startsAt), allDay: true },
    { id: `${c.id}-open`, title: `예매 ${c.title}`, start: kstDayKey(c.ticketOpenAt), allDay: true, classNames: ['is-open'] },
  ])

  return (
    <>
      <AppHeader title="공연 캘린더" />
      <div className="bg-surface px-2 pb-2 pt-2">
        <FullCalendar
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          initialDate={kstDayKey(now)}
          locale="ko"
          timeZone="Asia/Seoul"
          height="auto"
          fixedWeekCount={false}
          dayMaxEvents={1}
          moreLinkContent={(arg) => `+${arg.num}`}
          headerToolbar={{ left: 'prev', center: 'title', right: 'next' }}
          dayCellContent={(arg) => arg.dayNumberText.replace('일', '')}
          dayCellClassNames={(arg) => (day && arg.date.toISOString().slice(0, 10) === day ? ['is-selected'] : [])}
          events={events}
          dateClick={(arg) => setDay(day === arg.dateStr ? null : arg.dateStr)}
          eventClick={(arg) => nav(`/concert/${arg.event.id.replace('-open', '')}`)}
        />
        <div className="mt-2 flex items-center gap-3 px-1 text-[11px] text-muted">
          <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-accent" />공연일</span>
          <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-sys" />예매 오픈</span>
          <span className="ml-auto">날짜를 누르면 그날 공연만 보여요</span>
        </div>
      </div>

      <section className="flex-1 px-4 py-4">
        <div className="mb-3 flex items-center gap-2">
          <Chip selected={onlyMine} onClick={() => setOnlyMine(true)} disabled={!myArtists.length}>관심 아티스트</Chip>
          <Chip selected={!onlyMine} onClick={() => setOnlyMine(false)}>전체 J-pop</Chip>
          {day && (
            <button className="ml-auto text-xs text-muted underline" onClick={() => setDay(null)}>
              날짜 선택 해제
            </button>
          )}
        </div>
        {!myArtists.length && (
          <p className="mb-3 rounded-xl bg-user-soft p-3 text-xs text-user">
            관심 아티스트를 지정하면 내 공연만 모아 볼 수 있어요.{' '}
            <button className="font-bold underline" onClick={() => nav('/me/artists')}>지정하기</button>
          </p>
        )}
        <h2 className="mb-2 text-sm font-bold">
          {day ? `${Number(day.slice(5, 7))}월 ${Number(day.slice(8))}일 공연` : '다가오는 공연'}
        </h2>
        <div className="flex flex-col gap-2">
          {list.map((c) => <ConcertCard key={c.id} concert={c} mine={isMine(c.artistIds)} now={now} />)}
          {list.length === 0 && <p className="py-8 text-center text-sm text-muted">{day ? '이날은 공연이 없어요' : '예정된 공연이 없어요'}</p>}
        </div>
        <p className="mt-6 text-center text-[11px] text-muted">프로토타입 샘플 데이터예요. 실제 공연 정보가 아니에요.</p>
      </section>
    </>
  )
}
