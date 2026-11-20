const TZ = 'Asia/Seoul'

const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('ko-KR', { timeZone: TZ, hour12: false, ...o })

export const fmtDay = (iso: string) => fmt({ month: 'long', day: 'numeric', weekday: 'short' }).format(new Date(iso))
export const fmtTime = (iso: string) => fmt({ hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
export const fmtDateTime = (iso: string) => `${fmtDay(iso)} ${fmtTime(iso)}`

// 한국 시간 기준 날짜 키 (YYYY-MM-DD)
export const kstDayKey = (v: number | string) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(new Date(v))

export const DAY_MS = 86_400_000

// 공연 회차 목록 → "11월 14일(토) – 15일(일)" 같은 짧은 표기
// 지난 공연: 마지막 회차 날짜(KST)가 오늘보다 전
export const lastShow = (c: { schedules: string[] }) => c.schedules[c.schedules.length - 1] ?? ''
export const isPastConcert = (c: { schedules: string[] }) => !!c.schedules.length && kstDayKey(lastShow(c)) < kstDayKey(Date.now())
// 지금 시각 이전에 열린 마지막 회차 (없으면 ''). 진행 중인 공연도 이미 열린 회차가 있으면 잡힌다
export const lastPlayed = (c: { schedules: string[] }, now = Date.now()) =>
  c.schedules.filter((s) => Date.parse(s) < now).sort().pop() ?? ''
// 캘린더에서 이 공연으로 갈 날짜(KST): 지난 공연은 마지막 회차, 아니면 오늘 이후 첫 회차(진행 중 공연 포함)
export const focusDay = (c: { schedules: string[] }, today = kstDayKey(Date.now())) => {
  const days = c.schedules.map(kstDayKey).sort()
  return days.find((d) => d >= today) ?? days[days.length - 1] ?? today
}

export const fmtRange = (schedules: string[]) => {
  if (!schedules.length) return ''
  const first = fmtDay(schedules[0])
  if (schedules.length === 1) return first
  const days = [...new Set(schedules.map(kstDayKey))]
  return days.length === 1 ? first : `${first} 외 ${days.length - 1}일`
}

// 채팅 목록 시각: 오늘이면 시:분, 아니면 월.일
export const fmtRelative = (iso: string) => {
  const t = new Date(iso).getTime()
  const diff = Date.now() - t
  if (diff < 60_000) return '방금'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`
  if (kstDayKey(t) === kstDayKey(Date.now())) return fmtTime(iso)
  return fmt({ month: 'numeric', day: 'numeric' }).format(new Date(iso))
}

export const won = (n: number) => `${n.toLocaleString('ko-KR')}원`
