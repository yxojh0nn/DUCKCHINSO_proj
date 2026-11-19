import { useState } from 'react'
import { useMemberBadge } from '@/lib/queries'

// 구독 뱃지 (월 구독자만). 확정안 SVG(design/badges)를 그대로 쓴다: 개월이 늘수록 꼭짓점·음표 길이·금속 색이 바뀌고
//   24개월부터 겹 페르마타 왕관, 36개월은 잎 가지. 24px 이하는 디테일을 줄인 -sm 파일
export const BADGE_TIERS = [{ min: 1 }, { min: 3 }, { min: 6 }, { min: 12 }, { min: 24 }, { min: 36 }] as const

const FILES = import.meta.glob('../../design/badges/badge-*.svg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
export const fileOf = (min: number, small: boolean) => FILES[`../../design/badges/badge-${String(min).padStart(2, '0')}m${small ? '-sm' : ''}.svg`]

export const tierIndex = (months: number) => BADGE_TIERS.reduce((t, b, i) => (months >= b.min ? i : t), 0)
// 다음 뱃지까지 남은 개월 수 (마지막 단계면 null)
export const nextBadgeIn = (months: number) => {
  const next = BADGE_TIERS[tierIndex(months) + 1]
  return next ? next.min - months : null
}

// tip: 마우스를 올리거나(PC) 눌렀을 때(터치) "n개월간 구독중!" 말풍선. 단계표처럼 예시로 보여 줄 때는 끈다
export function MemberBadge({ months, size = 22, dim, tip = true, className = '' }: { months: number; size?: number; dim?: boolean; tip?: boolean; className?: string }) {
  const [open, setOpen] = useState(false)
  // months = 결제일부터 꽉 채운 달 수 (첫 달 0)
  const label = months === 0 ? '이번 달부터 구독중!' : `${months}개월간 구독중!`
  const img = (
    <img src={fileOf(BADGE_TIERS[tierIndex(months)].min, size <= 24)} width={size} height={size} draggable={false}
      alt={tip ? '' : `구독 ${months}개월 뱃지`} className={`shrink-0 select-none ${dim ? 'opacity-35 grayscale' : ''} ${tip ? '' : className}`} />
  )
  if (!tip) return img
  // 글 목록처럼 링크 안에 놓여도 누르면 이동하지 않고 말풍선만 연다 (button 안의 button을 피하려고 span)
  const toggle = (e: React.SyntheticEvent) => { e.preventDefault(); e.stopPropagation(); setOpen((o) => !o) }
  return (
    <span role="button" tabIndex={0} aria-label={label} aria-expanded={open} onClick={toggle} onBlur={() => setOpen(false)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggle(e) }}
      className={`group relative inline-flex shrink-0 cursor-pointer rounded-sm outline-offset-2 ${className}`}>
      {img}
      <span role="tooltip" className={`pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-2.5 py-1.5 text-[12px] font-semibold leading-none text-paper shadow-[0_4px_12px_rgba(0,0,0,0.18)] transition-opacity duration-150 ${open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        {label}
        <span aria-hidden className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-ink" />
      </span>
    </span>
  )
}

// 다른 사람(글쓴이 등)의 뱃지: 구독 중일 때만 보인다
export function UserBadge({ userId, size = 16, className }: { userId: string; size?: number; className?: string }) {
  const months = useMemberBadge(userId).data
  return months != null ? <MemberBadge months={months} size={size} className={className} /> : null
}
