// 로그인한 시각: JWT 의 amr[].timestamp (토큰을 새로 받아도 처음 로그인한 시각이 그대로 남는다)
// 서명 검증은 하지 않는다 — callerOf(auth.getUser) 로 이미 검증한 토큰에만 쓴다
export function signedInAt(jwt: string): number | null {
  try {
    const b = jwt.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const p = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b + '='.repeat((4 - b.length % 4) % 4)), (c) => c.charCodeAt(0))))
    const ts = (Array.isArray(p.amr) ? p.amr : []).map((a: { timestamp?: unknown }) => a?.timestamp).filter((n: unknown): n is number => typeof n === 'number')
    return ts.length ? Math.max(...ts) : null
  } catch {
    return null
  }
}

// 되돌릴 수 없는 작업(탈퇴 등) 전에: 최근 sec 초 안에 로그인했는지. 훔친 오래된 세션으로는 못 하게
export const signedInWithin = (jwt: string, sec: number, now = Date.now() / 1000) => {
  const t = signedInAt(jwt)
  return t !== null && t <= now + 60 && now - t <= sec
}
