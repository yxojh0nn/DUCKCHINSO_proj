const TZ = 'Asia/Seoul'

export const fmtDateTime = (iso: string) =>
  new Intl.DateTimeFormat('ko-KR', {
    timeZone: TZ, year: 'numeric', month: 'long', day: 'numeric',
    weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso))

export const fmtShort = (iso: string) =>
  new Intl.DateTimeFormat('ko-KR', {
    timeZone: TZ, month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso))

export const fmtTime = (ms: number) =>
  new Intl.DateTimeFormat('ko-KR', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(ms))

// 한국 시간 기준 날짜 키 (YYYY-MM-DD)
export const kstDayKey = (ms: number | string) =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: TZ }).format(new Date(ms))

export const DAY_MS = 86_400_000

export const remainText = (expiresAt: number, now: number) => {
  const left = expiresAt - now
  if (left <= 0) return '만료'
  const h = Math.floor(left / 3_600_000)
  return h >= 24 ? `${Math.floor(h / 24)}일 ${h % 24}시간 남음` : `${h}시간 남음`
}
