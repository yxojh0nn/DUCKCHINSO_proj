import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'plain' | 'destructive'
type Size = 'lg' | 'sm'

const variants: Record<Variant, string> = {
  primary: 'bg-ink text-paper active:opacity-75 disabled:bg-mist disabled:text-graphite',
  secondary: 'bg-mist text-ink active:bg-hairline disabled:text-graphite',
  plain: 'text-azure active:opacity-60 disabled:text-graphite',
  destructive: 'bg-mist text-danger active:bg-hairline',
}

const sizes: Record<Size, string> = {
  lg: 'h-[50px] rounded-[14px] px-5 t-head',
  sm: 'h-8 rounded-full px-3.5 t-sub font-semibold',
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; block?: boolean }

export function Button({ variant = 'primary', size = 'lg', block, className = '', ...rest }: Props) {
  return (
    <button
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 transition-[opacity,background-color] disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    />
  )
}
