// 네이버·카카오 로그인을 이 기기에 묶는다 (보안 감사 #1, PKCE 와 같은 원리)
// 시작할 때 verifier 를 만들어 이 기기에만 두고 서버에는 해시(cc)만 보낸다. 돌아온 #sl_code 는 verifier 와 함께 내야 토큰으로 바뀐다
// → 돌아오는 주소를 다른 앱이 가로채도, 남이 보낸 링크를 눌러도 이 기기의 verifier 가 없으니 로그인되지 않는다
// localStorage: 앱이 외부 브라우저로 로그인하는 동안 내려갔다 다시 떠도 남아 있어야 한다
const KEY = 'sl_verifier'
const TTL = 600_000 // social-login state 유효 시간과 같다
const KEEP = 5 // 로그인을 여러 번 눌렀다가 앞의 것으로 돌아와도 맞는 verifier 를 찾도록
type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type Saved = { v: string; c: string; at: number }

const b64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
export const challengeOf = async (v: string) =>
  b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(v))))

function read(s: Store, now: number): Saved[] {
  try {
    const list = JSON.parse(s.getItem(KEY) ?? '[]')
    return Array.isArray(list)
      ? list.filter((x): x is Saved => typeof x?.v === 'string' && typeof x?.c === 'string' && typeof x?.at === 'number' && now - x.at >= 0 && now - x.at < TTL)
      : []
  } catch { return [] }
}
const write = (s: Store, list: Saved[]) => {
  try {
    if (list.length) s.setItem(KEY, JSON.stringify(list))
    else s.removeItem(KEY)
  } catch { /* 저장 못 하면 돌아왔을 때 거절된다 */ }
}

// 로그인을 누를 때마다: verifier 를 저장하고 서버에 보낼 cc 를 돌려준다
export async function issueLoginVerifier(s: Store = localStorage, now = Date.now()) {
  const v = b64url(crypto.getRandomValues(new Uint8Array(32)))
  const c = await challengeOf(v)
  write(s, [...read(s, now).slice(-(KEEP - 1)), { v, c, at: now }])
  return c
}

// 돌아온 cc 에 맞는 verifier 를 한 번만 꺼낸다. 없으면 null (이 기기에서 시작한 로그인이 아니다 → 서버에 보내지 않는다)
export function takeLoginVerifier(c: string | null, s: Store = localStorage, now = Date.now()) {
  const list = read(s, now)
  const hit = c ? list.find((x) => x.c === c) : undefined
  write(s, list.filter((x) => x !== hit))
  return hit?.v ?? null
}
