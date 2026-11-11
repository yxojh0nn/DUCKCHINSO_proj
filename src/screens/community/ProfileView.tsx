import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api'
import { AppHeader, HeaderButton } from '@/components/AppHeader'
import { ConcertRow } from '@/components/ConcertRow'
import { ReportSheet } from '@/components/ReportSheet'
import { IconMore } from '@/components/icons'
import { Button } from '@/components/ui/Button'
import { Confirm } from '@/components/ui/Confirm'
import { Empty } from '@/components/ui/Empty'
import { Sheet } from '@/components/ui/Sheet'
import { ProfileHead } from '@/screens/my/ProfileHead'
import { useFriendActions } from '@/lib/actions'
import { kstDayKey } from '@/lib/date'
import { keys, useArtists, useConcerts, useGenres, useMe } from '@/lib/queries'

// 상대 프로필: 사진·배너·소개, 관심 공연, 다녀온 공연, 관심 아티스트·장르
export default function ProfileView() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const profile = useQuery({ queryKey: keys.profile(id), queryFn: () => api.getProfile(id) })
  const concerts = useConcerts().data ?? []
  const artists = useArtists().data ?? []
  const genres = useGenres().data ?? []
  const actions = useFriendActions()
  const viewerIsGuest = useMe().data?.isGuest !== false
  const [menu, setMenu] = useState(false)
  const [report, setReport] = useState(false)
  const [block, setBlock] = useState(false)

  if (profile.isError) return (<><AppHeader back /><Empty title="프로필을 볼 수 없어요" /></>)
  const p = profile.data
  if (!p) return <AppHeader back />

  const today = kstDayKey(Date.now())
  const favs = concerts.filter((c) => p.favoriteIds.includes(c.id))
  const upcoming = favs.filter((c) => c.schedules.some((s) => kstDayKey(s) >= today))
  const past = favs.filter((c) => !c.schedules.some((s) => kstDayKey(s) >= today))
  const self = p.relation === 'self'

  return (
    <div className="pb-[max(24px,env(safe-area-inset-bottom))]">
      <AppHeader back right={!self && <HeaderButton label="더보기" onClick={() => setMenu(true)}><IconMore /></HeaderButton>} />
      <ProfileHead profile={p}
        artistNames={p.artistIds.map((a) => artists.find((x) => x.id === a)?.name ?? '').filter(Boolean)}
        genreNames={p.genreIds.map((g) => genres.find((x) => x.id === g)?.name ?? '').filter(Boolean)} />

      {/* 친구 기능은 회원끼리만 (서버도 members_only 로 막는다) */}
      {!self && !viewerIsGuest && !p.isGuest && (
        <div className="px-5 pt-4">
          {p.relation === 'friend' && p.roomId ? <Button block size="md" onClick={() => nav(`/chats/${p.roomId}`)}>대화하기</Button>
            : p.relation === 'sent' ? <Button block size="md" variant="secondary" disabled>요청을 보냈어요</Button>
              : p.relation === 'received' ? <Button block size="md" onClick={() => nav('/community/requests')}>받은 요청 확인하기</Button>
                : <Button block size="md" onClick={() => actions.request(p.id)}>친구 요청 보내기</Button>}
        </div>
      )}

      <section className="mt-6">
        <h2 className="px-5 pb-1 t-head">관심 공연</h2>
        {upcoming.length ? <ul>{upcoming.map((c) => <ConcertRow key={c.id} concert={c} />)}</ul> : <p className="px-5 py-3 t-sub text-graphite">
            {/* 다가오는 관심 공연은 미래 동선이라 친구에게만 목록이 온다 */}
            {!self && p.relation !== 'friend' && p.upcomingCount ? `관심 공연 ${p.upcomingCount}개 · 친구가 되면 볼 수 있어요` : '아직 없어요'}</p>}
      </section>
      <section className="mt-4">
        <h2 className="px-5 pb-1 t-head">다녀온 공연</h2>
        {past.length ? <ul>{past.map((c) => <ConcertRow key={c.id} concert={c} />)}</ul> : <p className="px-5 py-3 t-sub text-graphite">아직 없어요</p>}
      </section>

      <Sheet open={menu} onClose={() => setMenu(false)} actions={[
        { label: '신고하기', danger: true, onClick: () => { setMenu(false); setReport(true) } },
        ...(viewerIsGuest ? [] : [{ label: '차단하기', danger: true, onClick: () => { setMenu(false); setBlock(true) } }]),
      ]} />
      <ReportSheet open={report} target={{ userId: p.id }} onClose={() => setReport(false)} />
      <Confirm open={block} title={`${p.nickname} 님을 차단할까요?`} message="서로의 글·추천·요청·채팅이 보이지 않게 돼요. 상대에게는 알리지 않아요."
        confirmLabel="차단" danger onClose={() => setBlock(false)}
        onConfirm={async () => { setBlock(false); if (await actions.block(p.id)) nav(-1) }} />
    </div>
  )
}
