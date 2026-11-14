import { tabArrows } from './a11y'

type Option<T extends string> = { value: T; label: string; disabled?: boolean }

type Props<T extends string> = { value: T; options: Option<T>[]; onChange: (v: T) => void; label: string }

// iOS 세그먼트 컨트롤. 필터·탭 전환에 공통으로 쓴다
export function Segmented<T extends string>({ value, options, onChange, label }: Props<T>) {
  return (
    <div role="tablist" aria-label={label} className="flex rounded-[10px] bg-mist p-0.5">
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            disabled={o.disabled}
            onKeyDown={(e) => tabArrows(e, options.filter((x) => !x.disabled).map((x) => x.value), value, onChange)}
            onClick={() => onChange(o.value)}
            className={`h-8 flex-1 rounded-[8px] t-sub transition-colors disabled:text-graphite disabled:opacity-40 ${
              on ? 'bg-paper font-semibold text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]' : 'text-graphite'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
