import { useState } from 'react'
import { IconCheck } from './icons'
import { SearchField } from './ui/Field'
import { LoadMore } from './LoadMore'

const PAGE = 50

type Item<T> = { id: T; label: string; sub?: string | null }

// 여러 개 고르기(관심 아티스트·장르). 최대 개수를 넘으면 더 고를 수 없다
export function PickList<T extends string | number>({ items, value, onChange, max, searchable, label }: {
  items: Item<T>[]; value: T[]; onChange: (v: T[]) => void; max: number; searchable?: boolean; label: string
}) {
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(PAGE) // 긴 목록(아티스트 수백 명)은 50개씩 스크롤 끝에서 이어 그린다
  const s = q.trim().toLowerCase()
  const matched = s ? items.filter((i) => `${i.label} ${i.sub ?? ''}`.toLowerCase().includes(s)) : items
  const shown = matched.slice(0, limit)
  const toggle = (id: T) => onChange(value.includes(id) ? value.filter((x) => x !== id) : value.length < max ? [...value, id] : value)
  return (
    <div>
      <p className="px-5 t-sub text-graphite num" aria-live="polite">{label} {value.length}/{max}</p>
      {searchable && (
        <SearchField className="mx-5 mt-3" value={q} onValue={(v) => { setQ(v); setLimit(PAGE) }} placeholder="이름으로 찾기" label={`${label} 검색`} />
      )}
      {items.length === 0 && <p className="px-5 py-8 t-sub text-graphite">목록을 준비하고 있어요. 나중에 MY &gt; 내 정보에서 고를 수 있어요.</p>}
      <ul className="mt-2">
        {shown.map((i) => {
          const on = value.includes(i.id)
          const full = !on && value.length >= max
          return (
            <li key={String(i.id)}>
              <button onClick={() => toggle(i.id)} disabled={full} aria-pressed={on}
                className="flex min-h-12 w-full items-center gap-3 px-5 py-2 text-left active:bg-mist disabled:opacity-35">
                <span className="min-w-0 flex-1">
                  <span className={`block truncate t-body ${on ? 'font-semibold' : ''}`}>{i.label}</span>
                  {i.sub && <span className="block truncate t-sub text-graphite">{i.sub}</span>}
                </span>
                <span className={`flex h-6 w-6 items-center justify-center rounded-full ${on ? 'bg-ink text-paper' : 'border-[1.5px] border-control-line'}`}>
                  {on && <IconCheck size={14} strokeWidth={2.6} />}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {matched.length > limit && <LoadMore key={limit} onMore={() => setLimit(limit + PAGE)} />}
    </div>
  )
}
