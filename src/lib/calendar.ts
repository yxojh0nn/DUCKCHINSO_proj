// 캘린더 표시 계산 (인앱 상세 기획 · 공연 캘린더)
// - 하루 공연: 점. 같은 날 여러 공연이면 점 여러 개, 색은 공연마다 다르게(채도는 비슷하게)
// - 같은 공연(투어)의 여러 회차: 선. 연속된 날은 이어진 선, 떨어진 날도 짧은 선으로 표시
// 순수 함수만 둔다 (calendar.test.ts)

// 채도·명도를 맞춘 차분한 색 8가지. 원색을 피하고 서로 구분만 되게 했다
export const EVENT_COLORS = ['#6F8CBF', '#C28770', '#7DA68B', '#A68BC0', '#BFA068', '#6AA4A4', '#BF7A97', '#8E9A63']

type Ev = { id: string; days: string[] } // days: KST 날짜 키(YYYY-MM-DD), 중복 없이 오름차순

export const colorOf = (id: string) => {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return EVENT_COLORS[h % EVENT_COLORS.length]
}

const shift = (key: string, d: number) => new Date(Date.parse(`${key}T00:00:00Z`) + d * 86_400_000).toISOString().slice(0, 10)

// 일요일 시작 월간 격자. 앞뒤 빈칸은 null
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(Date.UTC(year, month - 1, 1))
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const cells: (string | null)[] = Array(first.getUTCDay()).fill(null)
  for (let d = 1; d <= last; d++) cells.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  while (cells.length % 7) cells.push(null)
  return Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7))
}

export type Segment = { id: string; lane: number; color: string; joinLeft: boolean; joinRight: boolean }
export type DayMarks = { dots: { id: string; color: string }[]; segments: Segment[]; hidden: number }

export function layoutMarks(events: Ev[], maxLanes = 2, maxDots = 4): Map<string, DayMarks> {
  const out = new Map<string, DayMarks>()
  const at = (k: string) => {
    if (!out.has(k)) out.set(k, { dots: [], segments: [], hidden: 0 })
    return out.get(k)!
  }
  const lanes: Set<string>[] = []
  for (const ev of [...events].sort((a, b) => a.days[0].localeCompare(b.days[0]) || a.id.localeCompare(b.id))) {
    const color = colorOf(ev.id)
    if (ev.days.length === 1) {
      const m = at(ev.days[0])
      if (m.dots.length < maxDots) m.dots.push({ id: ev.id, color })
      else m.hidden++
      continue
    }
    // 겹치지 않는 가장 위 줄(lane)에 넣어 이어진 선이 칸마다 같은 높이에 오게 한다
    let lane = lanes.findIndex((used) => ev.days.every((d) => !used.has(d)))
    if (lane < 0) { lane = lanes.length; lanes.push(new Set()) }
    ev.days.forEach((d) => lanes[lane].add(d))
    const set = new Set(ev.days)
    for (const d of ev.days) {
      const m = at(d)
      if (lane >= maxLanes) { m.hidden++; continue }
      const dow = new Date(`${d}T00:00:00Z`).getUTCDay()
      m.segments.push({ id: ev.id, lane, color, joinLeft: dow !== 0 && set.has(shift(d, -1)), joinRight: dow !== 6 && set.has(shift(d, 1)) })
    }
  }
  return out
}

// 이름 모드: 날짜별 공연 id 목록 (시작 순)
export function dayIndex(events: Ev[]) {
  const out = new Map<string, string[]>()
  for (const ev of events) for (const d of ev.days) out.set(d, [...(out.get(d) ?? []), ev.id])
  return out
}
