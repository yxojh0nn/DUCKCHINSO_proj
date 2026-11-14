import { useMemo } from 'react'
import type { Concert } from '@/api'
import { dayIndex, layoutMarks, monthGrid, colorOf } from '@/lib/calendar'
import { kstDayKey } from '@/lib/date'
import type { CalMode } from '@/store/ui'

type Props = {
  year: number
  month: number
  concerts: Concert[]
  favoriteIds: string[]
  selected: string | null
  today: string
  mode: CalMode
  artistName: (id: string) => string
  onSelect: (day: string) => void
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토']

// 월간 캘린더. 칸 테두리 없이 숫자와 표시만 둔다. 날짜 칸 하나 = 버튼 하나
export function MonthCalendar({ year, month, concerts, favoriteIds, selected, today, mode, artistName, onSelect }: Props) {
  const weeks = useMemo(() => monthGrid(year, month), [year, month])
  const events = useMemo(
    () => concerts.map((c) => ({ id: c.id, days: [...new Set(c.schedules.map(kstDayKey))].sort() })),
    [concerts],
  )
  const marks = useMemo(() => layoutMarks(events), [events])
  const byDay = useMemo(() => dayIndex(events), [events])
  const favDays = useMemo(() => {
    const s = new Set<string>()
    concerts.filter((c) => favoriteIds.includes(c.id)).forEach((c) => c.schedules.forEach((x) => s.add(kstDayKey(x))))
    return s
  }, [concerts, favoriteIds])
  const byId = useMemo(() => new Map(concerts.map((c) => [c.id, c])), [concerts])

  return (
    <div role="grid" aria-label={`${year}년 ${month}월`}>
      <div role="row" className="grid grid-cols-7 pb-1.5">
        {WEEK.map((w) => <span key={w} role="columnheader" className="text-center t-cap text-graphite">{w}</span>)}
      </div>
      {weeks.map((week, wi) => (
        <div role="row" key={wi} className="grid grid-cols-7">
          {week.map((day, di) => {
            if (!day) return <span key={di} role="gridcell" />
            const ids = byDay.get(day) ?? []
            const m = marks.get(day)
            const isSel = day === selected
            const isToday = day === today
            const fav = favDays.has(day)
            const label = `${Number(day.slice(5, 7))}월 ${Number(day.slice(8))}일${ids.length ? `, 공연 ${ids.length}개` : ''}${fav ? ', 관심 공연' : ''}${isToday ? ', 오늘' : ''}`
            return (
              <button key={day} role="gridcell" aria-selected={isSel} aria-label={label} onClick={() => onSelect(day)}
                className="flex min-h-[60px] flex-col items-center pb-1 pt-0.5 active:opacity-60">
                <span className={`flex h-8 w-8 items-center justify-center rounded-full text-[15px] num ${
                  isSel ? 'bg-ink font-semibold text-paper'
                    : fav ? 'font-bold ring-[1.5px] ring-ink ring-inset'
                      : isToday ? 'font-bold' : ''}`}>
                  {Number(day.slice(8))}
                </span>
                {isToday && !isSel && <span aria-hidden className="-mt-1 h-[2px] w-3 rounded-full bg-ink" />}

                {mode === 'marks' ? (
                  <span aria-hidden className="mt-1 flex w-full flex-col items-center gap-[3px]">
                    <span className="flex h-[5px] gap-[3px]">
                      {m?.dots.map((d) => <i key={d.id} className="h-[5px] w-[5px] rounded-full" style={{ background: d.color }} />)}
                    </span>
                    {[0, 1].map((lane) => {
                      const s = m?.segments.find((x) => x.lane === lane)
                      return (
                        <span key={lane} className="flex h-[4px] w-full">
                          {s && (
                            <i className={`h-full ${s.joinLeft ? '' : 'ml-[22%] rounded-l-full'} ${s.joinRight ? '' : 'mr-[22%] rounded-r-full'} flex-1`}
                              style={{ background: s.color }} />
                          )}
                        </span>
                      )
                    })}
                    {!!m?.hidden && <span className="text-[10px] leading-none text-graphite">+{m.hidden}</span>}
                  </span>
                ) : (
                  <span aria-hidden className="mt-0.5 flex w-full flex-col gap-[2px] px-[2px]">
                    {ids.slice(0, 2).map((id) => {
                      const c = byId.get(id)!
                      return (
                        <span key={id} className="truncate rounded-[3px] px-[3px] text-left text-[9.5px] font-semibold leading-[13px] text-[#18181A]"
                          style={{ background: colorOf(id) }}>
                          {c.artistIds[0] ? artistName(c.artistIds[0]) : c.title}
                        </span>
                      )
                    })}
                    {ids.length > 2 && <span className="text-center text-[10px] leading-none text-graphite">+{ids.length - 2}</span>}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
