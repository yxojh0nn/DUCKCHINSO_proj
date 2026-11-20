// 소셜 로그인 CSRF 방지: 로그인을 시작한 기기에만 nonce 를 두고, 돌아온 #cn 이 같을 때만 토큰을 쓴다
// (남이 보낸 /auth/callback#token_hash=… 링크로 그 사람 계정에 로그인되는 것을 막는다)
// localStorage: 앱이 외부 브라우저로 로그인하는 동안 내려갔다 다시 떠도 남아 있어야 한다
const KEY = 'sl_cn'
const TTL = 600_000 // social-login state 유효 시간과 같다
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function issueLoginNonce(s: Store = localStorage, now = Date.now()) {
  const cn = crypto.randomUUID()
  try { s.setItem(KEY, JSON.stringify({ cn, at: now })) } catch { /* 저장 못 하면 돌아왔을 때 거절된다 */ }
  return cn
}

// 한 번만 쓴다: 맞든 틀리든 꺼내면서 지운다
export function takeLoginNonce(cn: string | null, s: Store = localStorage, now = Date.now()) {
  let saved: { cn?: unknown; at?: unknown } | null = null
  try { saved = JSON.parse(s.getItem(KEY) ?? 'null'); s.removeItem(KEY) } catch { /* 없거나 깨진 값 = 거절 */ }
  return !!cn && saved?.cn === cn && typeof saved.at === 'number' && now - saved.at >= 0 && now - saved.at < TTL
}
