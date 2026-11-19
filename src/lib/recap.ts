// 리캡: 다녀온 공연 기록을 달(YYYY-MM)·해(YYYY)로 묶는다. 화면 카드와 저장 이미지가 같은 데이터를 쓴다
type Rec = { concertId: string; day: string }
type Show = { id: string; title: string; posterUrl: string | null; venue: string; schedules: string[] }

export type RecapItem = { concertId: string; day: string; time: string | null; title: string; venue: string; posterUrl: string | null }
export type Recap = { period: string; items: RecapItem[] } // period: '2026-11' 또는 '2026'

const kstDay = (iso: string) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date(iso))
const kstTime = (iso: string) => new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso))

// 기간(달 또는 해)에 다녀온 공연, 다녀온 날 순. 그날 회차가 있으면 시작 시각도 (여러 회차면 첫 회차)
export function buildRecap(period: string, records: Rec[], concerts: Show[]): Recap {
  const items = records
    .filter((r) => r.day.startsWith(period))
    .map((r) => {
      const c = concerts.find((x) => x.id === r.concertId)
      const slot = c?.schedules.find((s) => kstDay(s) === r.day)
      return { concertId: r.concertId, day: r.day, time: slot ? kstTime(slot) : null, title: c?.title ?? '정리된 공연', venue: c?.venue ?? '', posterUrl: c?.posterUrl ?? null }
    })
    .sort((a, b) => a.day.localeCompare(b.day) || (a.time ?? '').localeCompare(b.time ?? ''))
  return { period, items }
}

// 기록이 있는 달 목록 (최근 순)
export const recapMonths = (records: Rec[]) => [...new Set(records.map((r) => r.day.slice(0, 7)))].sort().reverse()

// 리캡 진열 순서: 오래된 달부터, 한 해의 마지막 기록 달 다음에 그해 연간 리캡 (기록 있는 기간만)
export const recapShelf = (records: Pick<Rec, 'day'>[]) => {
  const months = [...new Set(records.map((r) => r.day.slice(0, 7)))].sort()
  return months.flatMap((m, i) => (months[i + 1]?.slice(0, 4) === m.slice(0, 4) ? [m] : [m, m.slice(0, 4)]))
}
// 진열 카드에 적는 이름: 달 '2026년 11월', 해 '돌아보기 26’'
export const shelfLabel = (p: string) => (p.length === 7 ? periodLabel(p) : `돌아보기 ${p.slice(2)}’`)

// '2026-11' → '2026년 11월', '2026' → '2026년'
export const periodLabel = (p: string) => (p.length === 7 ? `${p.slice(0, 4)}년 ${Number(p.slice(5))}월` : `${p}년`)
// '2026-11-07' → '11월 7일 (토)'
export const dayWithWeek = (d: string) => {
  const w = '일월화수목금토'[new Date(`${d}T12:00:00+09:00`).getUTCDay()]
  return `${Number(d.slice(5, 7))}월 ${Number(d.slice(8))}일 (${w})`
}
