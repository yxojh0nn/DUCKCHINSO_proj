import { Link } from 'react-router-dom'
import type { UserCard } from '@/api'
import { Avatar } from './ui/Avatar'

// 사람 한 줄: 왼쪽 사진·닉네임·소개글, 오른쪽 동작 버튼들
export function UserRow({ user, right, sub }: { user: UserCard; right?: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 px-5 py-2.5">
      <Link to={`/profile/${user.id}`} className="flex min-w-0 flex-1 items-center gap-3 active:opacity-60">
        <Avatar url={user.avatarUrl} name={user.nickname} />
        <span className="min-w-0 flex-1">
          <span className="block truncate t-body font-semibold">{user.nickname}</span>
          <span className="block truncate t-sub text-graphite">{sub ?? (user.bio || '소개글이 없어요')}</span>
        </span>
      </Link>
      {right && <div className="flex shrink-0 items-center gap-1">{right}</div>}
    </li>
  )
}
