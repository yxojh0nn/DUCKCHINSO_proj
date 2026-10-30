type Props = { checked: boolean; onChange: (v: boolean) => void; label: string }

export function Toggle({ checked, onChange, label }: Props) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${checked ? 'bg-accent' : 'bg-line'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  )
}
