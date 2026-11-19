// 멤버십 웹 결제 (포트원 V2 빌링키). 설계: docs/결제_멤버십_연동_설계.md 2장
// 앱이 하는 일은 결제창을 띄우고, 결제창이 준 빌링키를 서버에 넘기는 것뿐. 금액·결제·확인은 모두 서버가 한다
// 앱(iOS·Android)은 스토어 결제 규정 때문에 PG 결제를 보여 주지 않는다 (1단계는 웹만)
import { Capacitor } from '@capacitor/core'
import { api, isDemo } from '@/api'
import { phoneDigits, type Buyer } from './buyer'

export type PayMethodId = 'card' | 'kakaopay' | 'naverpay' | 'tosspay'
// needsBuyer: 카드 채널(KG이니시스)은 구매자 이름·휴대폰·이메일이 있어야 빌링키 발급·청구가 된다
export type PayMethod = { id: PayMethodId; label: string; channelKey: string; needsBuyer: boolean }
const LABEL: Record<PayMethodId, string> = { card: '신용·체크카드', kakaopay: '카카오페이', naverpay: '네이버페이', tosspay: '토스페이' }
const EASY: Partial<Record<PayMethodId, 'KAKAOPAY' | 'NAVERPAY' | 'TOSSPAY'>> = { kakaopay: 'KAKAOPAY', naverpay: 'NAVERPAY', tosspay: 'TOSSPAY' }
const STORE_ID = import.meta.env.VITE_PORTONE_STORE_ID as string | undefined
const ISSUE = 'pg_issue' // 모바일 결제창이 페이지를 옮겼다 돌아올 때까지 1회용 번호를 들고 있는 곳

// 열려 있는 결제 수단: VITE_PORTONE_CHANNELS="card:channel-key-…,kakaopay:channel-key-…" (공개값, 포트원 콘솔의 채널 키)
export function payMethods(): PayMethod[] {
  if (isDemo) return (Object.keys(LABEL) as PayMethodId[]).map((id) => ({ id, label: LABEL[id], channelKey: 'demo', needsBuyer: id === 'card' }))
  return String(import.meta.env.VITE_PORTONE_CHANNELS ?? '').split(',').map((s) => s.trim().split(':'))
    .filter(([id, key]) => id in LABEL && key)
    .map(([id, key]) => ({ id: id as PayMethodId, label: LABEL[id as PayMethodId], channelKey: key, needsBuyer: id === 'card' }))
}
export const webPayOn = () => !Capacitor.isNativePlatform() && (isDemo || (!!STORE_ID && payMethods().length > 0))

// 결제 시작 → 'done' | 'pending'(서버가 결과를 기다리는 중) | 'redirect'(모바일: 결제창으로 페이지가 넘어감)
export async function startMembership(method: PayMethod, buyer?: Buyer): Promise<'done' | 'pending' | 'redirect'> {
  const co = await api.pgCheckout()
  if (isDemo) return finish(co.issueId, `demo-${method.id}`)
  try { sessionStorage.setItem(ISSUE, co.issueId) } catch { /* 저장이 막혀도 PC 결제창은 그대로 된다 */ }
  const PortOne = (await import('@portone/browser-sdk/v2')).default
  const easy = EASY[method.id]
  const res = await PortOne.requestIssueBillingKey({
    storeId: STORE_ID!, channelKey: method.channelKey,
    // 네이버페이는 카드만: 포인트(CHARGE)는 나이스에서 현금영수증 정보가 필수라 받지 않는다
    ...(easy ? { billingKeyMethod: 'EASY_PAY' as const, easyPay: { easyPayProvider: easy, ...(easy === 'NAVERPAY' ? { availablePayMethods: ['CARD' as const] } : {}) } }
      : { billingKeyMethod: 'CARD' as const }),
    // 나이스: issueId 는 영문·숫자 40자 이내 → UUID 의 하이픈만 뺀다 (서버로는 원래 값을 보낸다, 결제사 쪽 번호는 서버가 믿지 않음)
    issueName: co.orderName, issueId: co.issueId.replaceAll('-', ''),
    customer: { customerId: co.customerId, // 사용자 id 대신 서버가 만든 고객 번호
      ...(buyer ? { fullName: buyer.name.trim(), phoneNumber: phoneDigits(buyer.phone), email: buyer.email.trim() } : {}) },
    offerPeriod: { interval: '1m' }, // 서비스 제공 주기 (이니시스 모바일 필수)
    redirectUrl: `${location.origin}/membership?pg=return`,
  })
  if (!res) return 'redirect'
  if (res.code || !res.billingKey) throw new Error(res.code === 'FAILURE_TYPE_PG' ? 'payment_failed' : 'payment_canceled')
  return finish(co.issueId, res.billingKey)
}

// 모바일 결제창에서 돌아왔을 때 (?pg=return&billingKey=…). 주소의 값은 믿지 않는다: 서버가 빌링키 주인을 다시 확인한다
export async function finishRedirect(params: URLSearchParams): Promise<'done' | 'pending'> {
  let issueId: string | null = null
  try { issueId = sessionStorage.getItem(ISSUE) } catch { /* 없음 */ }
  const billingKey = params.get('billingKey')
  if (params.get('code') || !billingKey || !issueId) {
    try { sessionStorage.removeItem(ISSUE) } catch { /* 없음 */ }
    throw new Error('payment_canceled')
  }
  return finish(issueId, billingKey)
}

async function finish(issueId: string, billingKey: string) {
  try { sessionStorage.removeItem(ISSUE) } catch { /* 없음 */ }
  const r = await api.pgStart(issueId, billingKey)
  return r.pending ? 'pending' as const : 'done' as const
}

export const won = (n: number) => `${n.toLocaleString('ko-KR')}원`
// 다음 결제일: 같은 날짜, 없는 달이면 말일 (서버 계산과 같은 규칙)
export function addMonth(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  x.setDate(Math.min(d.getDate(), new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate()))
  return x
}
