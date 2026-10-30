import { ARTISTS, type MockUser } from '@/data/mock'
import { Tag } from './ui/Chip'

type Props = { user: MockUser; score: number; overlap: string[]; action: React.ReactNode }

export function MatchCard({ user, score, overlap, action }: Props) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3.5">
      <div className="mb-2 flex items-center gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-user-soft font-bold text-user">{user.nickname[0]}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{user.nickname}</p>
          <p className="text-xs text-muted">{user.regionPublic ? user.region : '지역 비공개'}</p>
        </div>
        <span className="text-sm font-bold text-accent">{Math.round(score * 100)}%</span>
      </div>
      <div className="mb-3 flex flex-wrap gap-1">
        {overlap.map((id) => <Tag key={id} tone="user">{ARTISTS.find((a) => a.id === id)?.name}</Tag>)}
      </div>
      {action}
    </div>
  )
}
