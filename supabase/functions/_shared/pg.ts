// 포트원(PortOne) V2: 빌링키 조회·결제·취소, 웹훅 서명 확인. 설계: docs/결제_멤버십_연동_설계.md 2장
// 비밀값은 서버 함수 환경에만 둔다 (앱 번들 X, 로그 X):
//   PORTONE_API_SECRET · PORTONE_STORE_ID · PORTONE_WEBHOOK_SECRET · BILLING_ENC_KEY(빌링키 암호화)
//   PORTONE_ALLOW_TEST=true 는 스테이징에서만 (테스트 채널로 만든 빌링키를 받아 준다)
// 원칙: 앱이 보낸 결과·웹훅 본문은 믿지 않고, 늘 포트원 API 로 다시 조회한 값만 DB 에 넣는다

// deno-lint-ignore no-explicit-any
const g = globalThis as any
const env = (name: string): string | undefined => g.Deno?.env.get(name) ?? g.process?.env[name]
const API = 'https://api.portone.io'

export class PgError extends Error {
  type: string
  constructor(type: string, message?: string) { super(message ?? type); this.type = type }
}

const storeId = () => {
  const v = env('PORTONE_STORE_ID')
  if (!v) throw new PgError('missing_secret')
  return v
}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const secret = env('PORTONE_API_SECRET')
  if (!secret) throw new PgError('missing_secret')
  const res = await fetch(API + path, {
    ...init,
    headers: { Authorization: `PortOne ${secret}`, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(20_000),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new PgError(String(body?.type ?? `http_${res.status}`), typeof body?.message === 'string' ? body.message.slice(0, 200) : undefined)
  return body as T
}
const q = () => `?storeId=${encodeURIComponent(storeId())}`
const id = encodeURIComponent

// deno-lint-ignore no-explicit-any
type Json = any
export const getBillingKey = (key: string): Promise<Json> => call(`/billing-keys/${id(key)}${q()}`)
export const deleteBillingKey = (key: string) => call(`/billing-keys/${id(key)}${q()}`, { method: 'DELETE' })
export const getPayment = (paymentId: string): Promise<Json> => call(`/payments/${id(paymentId)}${q()}`)
export const payWithBillingKey = (paymentId: string, o: { billingKey: string; orderName: string; customer: Json; amountKrw: number }) =>
  call(`/payments/${id(paymentId)}/billing-key`, {
    method: 'POST',
    body: JSON.stringify({ storeId: storeId(), billingKey: o.billingKey, orderName: o.orderName, customer: o.customer,
      amount: { total: o.amountKrw, taxFree: 0 }, currency: 'KRW' }), // 전액 과세. 나이스 간편결제 빌링키는 면세금액을 꼭 받는다
  })
export const cancelPayment = (paymentId: string, amountKrw: number, reason: string) =>
  call(`/payments/${id(paymentId)}/cancel`, { method: 'POST', body: JSON.stringify({ storeId: storeId(), amount: amountKrw, reason }) })

// 청구 때 넘길 구매자: 빌링키 발급 때 결제창에 넣은 이름·휴대폰·이메일을 포트원에서 읽어 그대로 (KG이니시스는 청구마다 필수)
// 덕친소 DB 에는 저장하지 않는다. id 는 늘 우리 고객 번호
export function buyerOf(info: Json, customerToken: string): Json {
  const c = info?.customer ?? {}
  return { id: customerToken, ...(c.name ? { name: { full: c.name } } : {}), ...(c.phoneNumber ? { phoneNumber: c.phoneNumber } : {}), ...(c.email ? { email: c.email } : {}) }
}

// 빌링키가 우리 상점의, 이 사람(customer_token)의, 쓸 수 있는 키인지. 테스트 채널은 PORTONE_ALLOW_TEST 일 때만
export function checkBillingKey(info: Json, customerToken: string, store = env('PORTONE_STORE_ID'), allowTest = env('PORTONE_ALLOW_TEST') === 'true') {
  if (info?.status !== 'ISSUED') return { ok: false as const, reason: 'not_issued' }
  if (!store || info.storeId !== store) return { ok: false as const, reason: 'other_store' }
  if (info.customer?.id !== customerToken) return { ok: false as const, reason: 'other_customer' }
  const channels: Json[] = Array.isArray(info.channels) ? info.channels : []
  const test = channels.some((c) => c?.type !== 'LIVE')
  if (test && !allowTest) return { ok: false as const, reason: 'test_channel' }
  return { ok: true as const, env: test ? 'sandbox' : 'production' }
}

const EASY: Record<string, string> = { KAKAOPAY: '카카오페이', NAVERPAY: '네이버페이', TOSSPAY: '토스페이', PAYCO: '페이코', SAMSUNGPAY: '삼성페이', APPLEPAY: '애플페이' }
// 표시용 결제 수단 이름 (카드 번호는 끝 네 자리만, 포트원이 가린 자리는 쓰지 않는다)
export function methodLabel(info: Json): string {
  const m = Array.isArray(info?.methods) ? info.methods[0] : null
  if (m?.provider && EASY[m.provider]) return EASY[m.provider]
  if (m?.type && String(m.type).includes('EasyPay')) return '간편결제'
  if (m?.card) {
    const last = String(m.card.number ?? '').match(/(\d{4})$/)?.[1]
    return `${String(m.card.name ?? '카드').slice(0, 20)}${last ? ` ****${last}` : ''}`
  }
  return '등록한 결제 수단'
}

// 포트원 결제 조회 결과 → 우리가 쓸 상태. 우리 상점·원화가 아니면 실패로 본다
export type PayState =
  | { kind: 'paid'; krw: number; paidAt: string }
  | { kind: 'failed'; reason: string }
  | { kind: 'canceled'; canceledKrw: number }
  | { kind: 'pending' }
export function payState(p: Json, store = env('PORTONE_STORE_ID')): PayState {
  if (!store || p?.storeId !== store || p?.currency !== 'KRW') return { kind: 'failed', reason: 'bad_payment' }
  const s = p.status
  if (s === 'PAID') return { kind: 'paid', krw: Number(p.amount?.total), paidAt: String(p.paidAt ?? new Date().toISOString()) }
  if (s === 'CANCELLED' || s === 'PARTIAL_CANCELLED') return { kind: 'canceled', canceledKrw: Number(p.amount?.cancelled ?? p.amount?.total ?? 0) }
  if (s === 'FAILED') return { kind: 'failed', reason: String(p.failure?.reason ?? p.failure?.pgCode ?? 'failed').slice(0, 200) }
  return { kind: 'pending' }
}

// 조회한 결제를 DB 에 반영. 금액이 다르면 그 결제를 바로 취소한다 (DB 가 반영을 거절한 결제)
// deno-lint-ignore no-explicit-any
export async function settle(db: any, paymentId: string, p: Json | null): Promise<string> {
  const s: PayState = p ? payState(p) : { kind: 'failed', reason: 'not_created' }
  if (s.kind === 'pending') return 'pending'
  const rpc = async (fn: string, args: object) => {
    const { data, error } = await db.rpc(fn, args)
    if (error) throw new Error(error.message)
    return data as string
  }
  if (s.kind === 'canceled') return rpc('pg_charge_canceled', { pid: paymentId, canceled_total: s.canceledKrw })
  const r = s.kind === 'paid'
    ? await rpc('pg_charge_result', { pid: paymentId, ok: true, paid_krw: s.krw, paid: s.paidAt, reason: null })
    : await rpc('pg_charge_result', { pid: paymentId, ok: false, paid_krw: null, paid: null, reason: s.reason })
  if (r === 'amount_mismatch' && s.kind === 'paid') await cancelPayment(paymentId, s.krw, '결제 금액 불일치 자동 취소').catch(() => {})
  return r
}

// 결제 조회: 결제가 아예 만들어지지 않았으면 null (서버가 청구 전에 멈춘 경우)
export async function findPayment(paymentId: string): Promise<Json | null> {
  try { return await getPayment(paymentId) } catch (e) {
    if (e instanceof PgError && e.type === 'PAYMENT_NOT_FOUND') return null
    throw e
  }
}

// 웹훅 서명 (Standard Webhooks): HMAC-SHA256(secret, `${id}.${timestamp}.${본문}`), 5분 넘은 알림은 거절. 본문은 받은 그대로의 문자열
export async function verifyWebhook(body: string, headers: Headers, secret = env('PORTONE_WEBHOOK_SECRET') ?? '', now = Date.now()) {
  const wid = headers.get('webhook-id'), ts = headers.get('webhook-timestamp'), sig = headers.get('webhook-signature')
  if (!secret || !wid || !ts || !sig || !/^\d+$/.test(ts)) return false
  if (Math.abs(now / 1000 - Number(ts)) > 300) return false
  const raw = Uint8Array.from(atob(secret.replace(/^whsec_/, '')), (c) => c.charCodeAt(0))
  const key = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${wid}.${ts}.${body}`)))
  const want = btoa(String.fromCharCode(...mac))
  return sig.split(' ').some((part) => {
    const [ver, val] = part.split(',')
    return ver === 'v1' && !!val && val.length === want.length && timingSafeEqual(val, want)
  })
}
const timingSafeEqual = (a: string, b: string) => {
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

export async function sha256(text: string) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
  return Array.from(h, (b) => b.toString(16).padStart(2, '0')).join('')
}

// 서버가 만든 청구 번호만 받는다 (mbr_구독_회차_시도)
export const isOurPaymentId = (v: unknown): v is string => typeof v === 'string' && /^mbr_\d{1,18}_\d{1,4}_\d{1,2}$/.test(v)
