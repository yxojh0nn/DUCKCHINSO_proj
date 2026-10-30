type Props = { checked: boolean; onChange: (v: boolean) => void; children: React.ReactNode; strong?: boolean }

export function Checkbox({ checked, onChange, children, strong }: Props) {
  return (
    <label className={`flex flex-1 cursor-pointer items-center gap-2.5 py-2 ${strong ? 'font-bold' : 'text-sm'}`}>
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition ${
          checked ? 'border-accent bg-accent text-white' : 'border-line bg-surface'
        }`}
      >
        {checked && <svg viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 8.5l3 3 7-7" /></svg>}
      </span>
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {children}
    </label>
  )
}
