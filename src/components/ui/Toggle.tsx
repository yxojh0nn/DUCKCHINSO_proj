type Props = { checked: boolean; onChange: (v: boolean) => void; label: string }

export function Toggle({ checked, onChange, label }: Props) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${checked ? 'bg-ink' : 'bg-hairline'}`}
    >
      <span
        className={`absolute top-[2px] h-[27px] w-[27px] rounded-full bg-paper shadow-[0_2px_6px_rgba(0,0,0,0.18)] transition-[left] ${
          checked ? 'left-[22px]' : 'left-[2px]'
        }`}
      />
    </button>
  )
}
