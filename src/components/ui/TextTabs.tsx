import { tabArrows } from './a11y'

type Tab<T extends string> = { value: T; label: string; badge?: number }

// 글자만 있는 탭. 선택된 탭은 진하게 + 밑줄 (상자 없음)
export function TextTabs<T extends string>({ value, tabs, onChange, label }: { value: T; tabs: Tab<T>[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-5 px-5">
      {tabs.map((t) => {
        const on = t.value === value
        return (
          <button key={t.value} role="tab" aria-selected={on} tabIndex={on ? 0 : -1} onClick={() => onChange(t.value)}
            onKeyDown={(e) => tabArrows(e, tabs.map((x) => x.value), value, onChange)}
            className={`relative flex h-11 items-center gap-1 t-head transition-colors ${on ? 'text-ink' : 'text-graphite'}`}>
            {t.label}
            {!!t.badge && <span className="h-1.5 w-1.5 rounded-full bg-notice" aria-label={`새 항목 ${t.badge}개`} />}
            {on && <span aria-hidden className="absolute inset-x-0 bottom-1 h-[2px] rounded-full bg-ink" />}
          </button>
        )
      })}
    </div>
  )
}
