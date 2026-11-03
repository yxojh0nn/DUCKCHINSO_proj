import type { ButtonHTMLAttributes } from 'react'

// primary: 검은 바탕(누를 곳 하나), secondary: 옅은 회색 바탕, text: 바탕 없는 글자 버튼,
// danger: 붉은 글자(신고·탈퇴 등 경고), dangerFill: 되돌릴 수 없는 최종 확인
type Variant = 'primary' | 'secondary' | 'text' | 'danger' | 'dangerFill'
type Size = 'lg' | 'md' | 'sm'

const variants: Record<Variant, string> = {
  primary: 'bg-ink text-paper active:opacity-75 disabled:opacity-30',
  secondary: 'bg-mist text-ink active:opacity-70 disabled:opacity-40',
  text: 'text-ink active:opacity-50 disabled:opacity-30',
  danger: 'text-danger active:opacity-50 disabled:opacity-30',
  dangerFill: 'bg-danger text-white active:opacity-75 disabled:opacity-30',
}

const sizes: Record<Size, string> = {
  lg: 'h-[52px] rounded-[14px] px-5 t-head',
  md: 'h-11 rounded-[12px] px-4 t-body font-semibold',
  sm: 'h-9 rounded-full px-3 t-sub font-semibold',
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; block?: boolean }

export function Button({ variant = 'primary', size = 'lg', block, className = '', type = 'button', ...rest }: Props) {
  // 글자 버튼은 바탕이 없으므로 좌우 여백을 줄이고 터치 높이만 유지한다
  const pad = variant === 'text' || variant === 'danger' ? '!px-1' : ''
  return (
    <button
      type={type}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 transition-opacity disabled:cursor-not-allowed ${sizes[size]} ${variants[variant]} ${pad} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    />
  )
}
