// 알림 숫자(채팅·친구 요청). 주홍색: 눈에 띄지만 경고처럼 보이지 않게
// 글자는 테마와 상관없이 짙은 색: 흰 글자는 주홍 위에서 3.1:1(다크 2.3:1)이라 읽기 어렵다 → 짙은 색은 5.7:1 이상
export function Badge({ count, className = '' }: { count: number; className?: string }) {
  if (!count) return null
  return (
    <span className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-notice px-1.5 text-[11px] font-semibold leading-none text-[#18181A] num ${className}`}>
      {count > 99 ? '99+' : count}
    </span>
  )
}
