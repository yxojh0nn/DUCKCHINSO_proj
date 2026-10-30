import { useMemo, useState } from 'react'
import { ARTISTS } from '@/data/mock'
import { APP_SETTINGS } from '@/lib/settings'
import { Chip } from './ui/Chip'

type Props = { value: string[]; onChange: (ids: string[]) => void }

// 관심 아티스트 지정 (기획서 5.1). 첫 진입과 내 정보에서 같이 쓴다
export function ArtistPicker({ value, onChange }: Props) {
  const [q, setQ] = useState('')
  const max = APP_SETTINGS.maxArtists
  const list = useMemo(() => {
    const k = q.trim().toLowerCase()
    return k ? ARTISTS.filter((a) => a.name.includes(k) || a.nameJa.toLowerCase().includes(k)) : ARTISTS
  }, [q])
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : value.length < max ? [...value, id] : value)

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="text-muted">최대 {max}명까지 고를 수 있어요</span>
        <span className={value.length >= max ? 'font-bold text-accent' : 'text-muted'}>{value.length} / {max}</span>
      </div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="아티스트 검색 (한글·일본어·영문)"
        className="mb-3 w-full rounded-xl border border-line bg-chip px-3 py-2.5 text-sm outline-none focus:border-accent"
      />
      {ARTISTS.length === 0 ? (
        <p className="rounded-xl bg-chip p-4 text-sm text-muted">아티스트 목록을 준비 중이에요. 지금은 건너뛰고 나중에 지정할 수 있어요.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {list.map((a) => {
            const on = value.includes(a.id)
            return (
              <Chip key={a.id} selected={on} disabled={!on && value.length >= max} onClick={() => toggle(a.id)}>
                {a.name} <span className="text-xs opacity-60">{a.nameJa}</span>
              </Chip>
            )
          })}
          {list.length === 0 && <p className="text-sm text-muted">검색 결과가 없어요</p>}
        </div>
      )}
    </div>
  )
}
