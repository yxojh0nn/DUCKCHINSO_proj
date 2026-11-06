// 개인정보 암호화 (docs/로그인_계정_암호화_설계.md 6장). Web Crypto 만 쓴다 → Deno(서버 함수)와 Node(테스트) 둘 다 돈다
// 키는 서버 함수 비밀값(32바이트 base64)에만 있다: PII_ENC_KEY(AES-256-GCM) · PII_HMAC_KEY(찾기용 HMAC) · LOGIN_STATE_KEY(로그인 state 서명)
// 비밀번호는 여기서 다루지 않는다. Supabase 가 bcrypt 해시로만 저장하고 복호화하지 않는다

// deno-lint-ignore no-explicit-any
const g = globalThis as any
const env = (name: string): string | undefined => g.Deno?.env.get(name) ?? g.process?.env[name]

const enc = new TextEncoder()
const b64 = (b: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(b)))
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0))
const b64url = (b: ArrayBuffer | Uint8Array) => b64(b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const unb64url = (s: string) => unb64(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4))

function secret(name: string) {
  const v = env(name)
  const raw = v ? unb64(v) : null
  if (!raw || raw.length < 32) throw new Error(`missing_secret:${name}`) // 값은 로그에 남기지 않는다
  return raw
}
const aesKey = () => crypto.subtle.importKey('raw', secret('PII_ENC_KEY'), 'AES-GCM', false, ['encrypt', 'decrypt'])
const hmacKey = (name: string) => crypto.subtle.importKey('raw', secret(name), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])

// "v1:iv:암호문". AAD = 사용자 id + 항목 이름 → 다른 사람·다른 칸의 암호문을 옮겨 붙이면 복호화가 실패한다
export async function encrypt(userId: string, field: string, text: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(`${userId}:${field}`) }, await aesKey(), enc.encode(text))
  return `v1:${b64(iv)}:${b64(ct)}`
}

export async function decrypt(userId: string, field: string, value: string) {
  const [v, iv, ct] = value.split(':')
  if (v !== 'v1' || !iv || !ct) throw new Error('bad_ciphertext')
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv), additionalData: enc.encode(`${userId}:${field}`) }, await aesKey(), unb64(ct))
  return new TextDecoder().decode(pt)
}

// 찾기용 값(블라인드 인덱스). 같은 입력이면 항상 같은 값. scope 로 용도를 나눠 아이디와 네이버 id 가 같은 값이 되지 않게 한다
export async function blindIndex(scope: string, text: string) {
  return b64(await crypto.subtle.sign('HMAC', await hmacKey('PII_HMAC_KEY'), enc.encode(`${scope}:${text}`)))
}

// 메일 인증 코드: 영문 대문자·숫자 6자리. 헷갈리는 0·O·1·I 는 뺀 32글자 (32 = 2^5 라 치우침이 없다)
export function emailCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => chars[b & 31]).join('')
}

// 로그인 state: 서명한 JSON + 만료. 서명이 틀리거나 만료되면 null
export async function signState(payload: Record<string, unknown>, ttlSec = 600) {
  const body = enc.encode(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec }))
  const sig = await crypto.subtle.sign('HMAC', await hmacKey('LOGIN_STATE_KEY'), body)
  return `${b64url(body)}.${b64url(sig)}`
}

export async function verifyState(token: string): Promise<Record<string, unknown> | null> {
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  try {
    const raw = unb64url(body)
    if (!(await crypto.subtle.verify('HMAC', await hmacKey('LOGIN_STATE_KEY'), unb64url(sig), raw))) return null
    const p = JSON.parse(new TextDecoder().decode(raw))
    return typeof p.exp === 'number' && p.exp > Date.now() / 1000 ? p : null
  } catch {
    return null
  }
}
