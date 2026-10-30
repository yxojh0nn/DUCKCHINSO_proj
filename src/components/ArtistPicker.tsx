import { useMemo, useState } from 'react'
import { ARTISTS } from '@/data/mock'
import { APP_SETTINGS } from '@/lib/settings'
import { CheckMark } from './ui/Checkbox'

type Props = { value: string[]; onChange: (ids: string[]) => void }

// 관심 아티스트 지정 (기획서 5.1). 첫 진입과 내 정보에서 같이 쓴다
export function ArtistPicker({ value, onChange }: Props) {
  const [q, setQ] = useState('')
  const max = APP_SETTINGS.maxArtists
  const list = useMemo(() => {
    const k = q.trim().toLowerCase()
    return k ? ARTISTS.filter((a) => a.name.includes(k) || a.nameJa.toLowerCase().includes(k)) : ARTISTS
  }, [q])
  const full = value.length >= max
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : full ? value : [...value, id])

  return (
    <div>
      <div className="px-5">
        <label className="flex h-9 items-center gap-2 rounded-[10px] bg-mist px-2.5 text-graphite">
          <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="7" cy="7" r="5" /><path d="M11 11l3.5 3.5" strokeLinecap="round" /></svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="아티스트 검색"
            aria-label="아티스트 검색"
            className="min-w-0 flex-1 bg-transparent t-body text-ink outline-none placeholder:text-graphite"
          />
        </label>
        <p className="mt-3 t-sub text-graphite num" aria-live="polite">
          {full ? `${max}명을 모두 골랐어요. 바꾸려면 하나를 해제해 주세요.` : `${value.length}명 선택 · 최대 ${max}명`}
        </p>
      </div>

      {ARTISTS.length === 0 ? (
        <p className="px-5 py-10 t-body text-graphite">아티스트 목록을 준비하고 있어요. 지금은 건너뛰고 나중에 내 정보에서 고를 수 있어요.</p>
      ) : (
        <ul className="mt-2">
          {list.map((a) => {
            const on = value.includes(a.id)
            const disabled = !on && full
            return (
              <li key={a.id} className="group relative">
                <button
                  onClick={() => toggle(a.id)}
                  disabled={disabled}
                  aria-pressed={on}
                  className="flex min-h-[58px] w-full items-center gap-3 px-5 text-left active:bg-mist disabled:opacity-35"
                >
                  <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-mist t-head text-graphite">{a.nameJa[0]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate t-head">{a.name}</span>
                    <span className="block truncate t-sub text-graphite">{a.nameJa}</span>
                  </span>
                  <CheckMark checked={on} />
                </button>
                <span aria-hidden className="absolute bottom-0 left-[72px] right-0 h-px bg-hairline/70 group-last:hidden" />
              </li>
            )
          })}
          {list.length === 0 && <li className="px-5 py-10 t-body text-graphite">"{q}"와 일치하는 아티스트가 없어요.</li>}
        </ul>
      )}
    </div>
  )
}
