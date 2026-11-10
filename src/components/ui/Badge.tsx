// 알림 숫자(채팅·친구 요청). 주홍색: 눈에 띄지만 경고처럼 보이지 않게
export function Badge({ count, className = '' }: { count: number; className?: string }) {
  if (!count) return null
  return (
    <span className={`inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-notice px-1.5 text-[11px] font-semibold leading-none text-white num ${className}`}>
      {count > 99 ? '99+' : count}
    </span>
  )
}
