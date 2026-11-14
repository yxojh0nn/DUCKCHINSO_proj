type Props = { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode; strong?: boolean }

export function CheckMark({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full transition-colors ${
        checked ? 'bg-ink text-paper' : 'border-[1.5px] border-control-line'
      }`}
    >
      {checked && (
        <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 8.5l3 3 6-6.5" />
        </svg>
      )}
    </span>
  )
}

export function Checkbox({ checked, onChange, children, strong }: Props) {
  return (
    <label className={`flex min-h-11 flex-1 cursor-pointer items-center gap-3 ${strong ? 't-head' : 't-body'}`}>
      <CheckMark checked={checked} />
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  )
}
