// 요청 간격·KOPIS 날짜 형식. Edge Function(Deno)과 scripts(Node) 공용이라 런타임 전용 API 를 쓰지 않는다
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
export const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '') // KOPIS stdate·eddate (YYYYMMDD)
