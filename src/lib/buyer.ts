// 카드 결제(KG이니시스)가 요구하는 구매자 정보. 결제창에만 넘기고 덕친소 DB 에는 저장하지 않는다
// (매달 청구 때 서버는 포트원 빌링키 정보에서 다시 읽는다: supabase/functions/_shared/pg.ts buyerOf)
export type Buyer = { name: string; phone: string; email: string }

export const phoneDigits = (s: string) => s.replace(/\D/g, '')

export function buyerError(b: Buyer): string | null {
  if (!b.name.trim() || b.name.trim().length > 30) return '이름을 입력해 주세요.'
  if (!/^01[016789]\d{7,8}$/.test(phoneDigits(b.phone))) return '휴대폰 번호를 확인해 주세요.'
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email.trim())) return '이메일을 확인해 주세요.'
  return null
}
