import type { ButtonHTMLAttributes } from 'react'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean }

export function Chip({ selected, className = '', ...rest }: Props) {
  return (
    <button
      aria-pressed={selected}
      className={`rounded-full border px-3 py-1.5 text-sm transition disabled:opacity-40 ${
        selected ? 'border-accent bg-accent-soft text-accent font-semibold' : 'border-line bg-surface text-ink hover:bg-chip'
      } ${className}`}
      {...rest}
    />
  )
}

export function Tag({ children, tone = 'muted' }: { children: React.ReactNode; tone?: 'muted' | 'accent' | 'user' | 'sys' }) {
  const t = {
    muted: 'bg-chip text-muted',
    accent: 'bg-accent-soft text-accent',
    user: 'bg-user-soft text-user',
    sys: 'bg-sys-soft text-sys',
  }[tone]
  return <span className={`inline-block rounded-md px-1.5 py-0.5 text-[11px] font-medium ${t}`}>{children}</span>
}
