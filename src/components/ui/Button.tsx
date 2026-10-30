import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const styles: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:brightness-110 disabled:bg-line disabled:text-muted',
  secondary: 'bg-chip text-ink border border-line hover:bg-line disabled:opacity-50',
  ghost: 'text-muted hover:text-ink',
  danger: 'bg-crit/10 text-crit hover:bg-crit/20',
}

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; block?: boolean }

export function Button({ variant = 'primary', block, className = '', ...rest }: Props) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed ${styles[variant]} ${block ? 'w-full' : ''} ${className}`}
      {...rest}
    />
  )
}
