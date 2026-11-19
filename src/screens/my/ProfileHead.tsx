import { useState } from 'react'
import type { Profile } from '@/api'
import { IconChevronDown } from '@/components/icons'
import { Avatar } from '@/components/ui/Avatar'
import { MemberBadge } from '@/components/MemberBadge'

// 프로필 머리: 배너 사진 위에 프로필 사진, 닉네임, 소개글, 관심 아티스트(넘치면 … + 펼치기)
export function ProfileHead({ profile, artistNames, genreNames, action, badge }: {
  profile: Pick<Profile, 'nickname' | 'bio' | 'avatarUrl' | 'bannerUrl' | 'isGuest'>
  artistNames: string[]
  genreNames?: string[]
  action?: React.ReactNode
  badge?: number | null // 구독 개월 수 (월 구독자만)
}) {
  const [open, setOpen] = useState(false)
  const line = artistNames.join(' · ')
  return (
    <section>
      <div className="h-[120px] bg-mist" style={profile.bannerUrl ? { background: `center/cover url("${profile.bannerUrl}")` } : undefined} role="img"
        aria-label={profile.bannerUrl ? '배너 사진' : undefined} />
      <div className="-mt-10 flex items-end justify-between px-5">
        <span className="rounded-full ring-4 ring-paper"><Avatar url={profile.avatarUrl} name={profile.nickname} size={80} /></span>
        {action}
      </div>
      <div className="px-5 pt-3">
        <h1 className="flex flex-wrap items-center gap-x-2 gap-y-1 t-title">
          <span>{profile.nickname}</span>
          {profile.isGuest && <span className="t-sub font-medium text-graphite">비회원</span>}
          {badge != null && <MemberBadge months={badge} />}
        </h1>
        <p className="mt-1 whitespace-pre-wrap t-body text-graphite">{profile.bio || '소개글이 아직 없어요.'}</p>
        {artistNames.length > 0 && (
          <div className="mt-3 flex items-start gap-1">
            <p className={`flex-1 t-sub ${open ? '' : 'truncate'}`}><span className="font-semibold">관심 아티스트 </span>{line}</p>
            <button aria-label={open ? '관심 아티스트 접기' : '관심 아티스트 모두 보기'} aria-expanded={open} onClick={() => setOpen(!open)}
              className="-mt-2.5 flex h-10 w-10 shrink-0 items-center justify-center text-graphite">
              <IconChevronDown size={18} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
          </div>
        )}
        {genreNames && genreNames.length > 0 && <p className="mt-1 t-sub"><span className="font-semibold">관심 장르 </span>{genreNames.join(' · ')}</p>}
      </div>
    </section>
  )
}
