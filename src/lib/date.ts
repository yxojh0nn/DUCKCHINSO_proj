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
