// 구독 시작(결제)일부터 꽉 채운 달 수: 첫 달 0, 같은 날짜·시각이 돌아올 때마다 1씩 는다.
// 31일에 시작했으면 짧은 달은 그달 말일을 같은 날짜로 본다. DB 의 sub_months(age 기준)와 같은 규칙
export const fullMonths = (since: Date, now: Date) => {
  let n = (now.getFullYear() - since.getFullYear()) * 12 + now.getMonth() - since.getMonth()
  const at = (k: number) => {
    const d = new Date(since)
    d.setDate(1)
    d.setMonth(d.getMonth() + k)
    d.setDate(Math.min(since.getDate(), new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()))
    return d
  }
  if (at(n) > now) n--
  return Math.max(0, n)
}
