import { ARTISTS, type MockUser } from '@/data/mock'

type Props = { user: MockUser; score: number; overlap: string[]; action: React.ReactNode; note?: React.ReactNode }

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-mist font-semibold text-graphite"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {name[0]}
    </span>
  )
}

// 매칭 한 줄: 겹치는 아티스트를 먼저 보여 준다
export function MatchRow({ user, score, overlap, action, note }: Props) {
  const names = overlap.map((id) => ARTISTS.find((a) => a.id === id)?.name).join(', ')
  return (
    <li className="group relative px-5 py-4">
      <div className="flex items-center gap-3">
        <Avatar name={user.nickname} />
        <div className="min-w-0 flex-1">
          <p className="truncate t-head">{user.nickname}</p>
          <p className="t-sub text-graphite">{user.regionPublic ? user.region : '지역 비공개'}</p>
        </div>
        <span className="text-right">
          <span className="block text-[20px] font-semibold leading-6 tracking-[-0.02em] num">{Math.round(score * 100)}%</span>
          <span className="block t-cap text-graphite">취향 일치</span>
        </span>
      </div>
      <p className="mt-2.5 pl-[56px] t-sub">
        <span className="text-graphite">함께 좋아하는 아티스트 </span>
        {names}
      </p>
      {note && <p className="mt-1 pl-[56px] t-sub text-graphite">{note}</p>}
      <div className="mt-3 pl-[56px]">{action}</div>
      <span aria-hidden className="absolute bottom-0 left-[76px] right-0 h-px bg-hairline/70 group-last:hidden" />
    </li>
  )
}
