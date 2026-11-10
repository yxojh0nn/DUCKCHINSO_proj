import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api'
import { AppHeader, HeaderButton } from '@/components/AppHeader'
import { PostRow } from '@/components/PostRow'
import { UserRow } from '@/components/UserRow'
import { PastConcerts } from './PastConcerts'
import { IconClose, IconFilter, IconRequests, IconSearch } from '@/components/icons'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Empty } from '@/components/ui/Empty'
import { Sheet } from '@/components/ui/Sheet'
import { TextTabs } from '@/components/ui/TextTabs'
import { useFriendActions } from '@/lib/actions'
import { keys, useArtists, useGenres, useMe, useRequests } from '@/lib/queries'

type Filter = { genreId?: number; artistId?: string }

// 커뮤니티 탭: 상단 검색·범주·친구 요청함, 아래 커뮤니티(기본) / 후기 남기기(지난 공연) / 추천 덕친
export default function Community() {
  const nav = useNavigate()
  const me = useMe()
  // 보던 하위 탭을 주소에 남겨서 프로필을 보고 돌아와도 유지
  const [params, setParams] = useSearchParams()
  const t0 = params.get('tab')
  const tab = t0 === 'friends' || t0 === 'reviews' ? t0 : 'feed'
  const setTab = (t: 'feed' | 'reviews' | 'friends') => setParams(t === 'feed' ? {} : { tab: t }, { replace: true })
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>({})
  const [filterOpen, setFilterOpen] = useState(false)
  const genres = useGenres().data ?? []
  const artists = useArtists().data ?? []
  const requests = useRequests().data ?? []
  const incoming = requests.filter((r) => r.direction === 'in').length
  const actions = useFriendActions()
  const term = q.trim()
  const filtered = !!(filter.genreId || filter.artistId)

  const posts = useQuery({ queryKey: keys.posts({ q: term }), queryFn: () => api.listPosts({ q: term }), enabled: tab === 'feed' })
  const people = useQuery({
    queryKey: [...keys.recommend, term, filter],
    queryFn: () => (term || filtered ? api.searchUsers(term, filter) : api.recommend()),
    enabled: tab === 'friends',
  })

  if (me.data && !me.data.communityAgreedAt) return <Navigate to="/community/rules" replace />
  if (me.data && !me.data.profileSetupDone) return <Navigate to="/community/setup" replace />

  const filterLabel = filter.genreId ? genres.find((g) => g.id === filter.genreId)?.name
    : filter.artistId ? artists.find((a) => a.id === filter.artistId)?.name : null

  return (
    <>
      <AppHeader large title="커뮤니티" right={
        <HeaderButton label={`대기 중인 친구 요청 ${incoming}개`} onClick={() => nav('/community/requests')}>
          <IconRequests />
          <Badge count={incoming} className="absolute right-0.5 top-1" />
        </HeaderButton>
      } />
      <div className="flex items-center gap-1 pl-5 pr-2">
        <label className="flex h-10 flex-1 items-center gap-2 rounded-[10px] bg-mist px-3">
          <IconSearch size={18} className="text-graphite" />
          <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="검색어"
            placeholder={tab === 'feed' ? '글 제목, 내용, 태그' : tab === 'reviews' ? '지난 공연 검색' : '닉네임이나 소개글 키워드'} className="h-full min-w-0 flex-1 outline-none t-body" />
          {q && <button aria-label="검색어 지우기" onClick={() => setQ('')} className="text-graphite"><IconClose size={16} /></button>}
        </label>
        <HeaderButton label="검색 범주 설정" onClick={() => { setTab('friends'); setFilterOpen(true) }}>
          <IconFilter />
          {filtered && <span className="absolute right-2 top-2.5 h-2 w-2 rounded-full bg-notice" />}
        </HeaderButton>
      </div>
      <div className="mt-1 flex items-center justify-between border-b border-hairline pr-3">
        <TextTabs label="커뮤니티 보기" value={tab} onChange={setTab} tabs={[{ value: 'feed', label: '커뮤니티' }, { value: 'reviews', label: '후기 남기기' }, { value: 'friends', label: '추천 덕친' }]} />
        {tab === 'feed' && !me.data?.isGuest && <Link to="/community/write" className="flex h-11 items-center px-2 t-body font-semibold">글쓰기</Link>}
      </div>

      {me.data?.isGuest && tab !== 'friends' && <p className="px-5 pt-3 t-sub text-graphite">비회원은 글·후기를 쓸 수 없어요. 회원으로 로그인하면 쓸 수 있어요.</p>}
      {tab === 'reviews' ? <PastConcerts q={term} /> : tab === 'feed' ? (
        posts.data?.length ? <ul className="pb-6">{posts.data.map((p) => <PostRow key={p.id} post={p} />)}</ul>
          : <Empty title={posts.isLoading ? '불러오는 중…' : term ? '맞는 글이 없어요' : '아직 글이 없어요'}
              action={!posts.isLoading && !me.data?.isGuest && <Button size="md" onClick={() => nav('/community/write')}>글쓰기</Button>} />
      ) : (
        <>
          {(term || filtered) && (
            <div className="flex items-center gap-2 px-5 pb-1 pt-3">
              <p className="flex-1 t-sub text-graphite">검색 결과{filterLabel ? ` · ${filterLabel}` : ''}</p>
              {filtered && <button className="h-9 t-sub font-semibold" onClick={() => setFilter({})}>범주 해제</button>}
            </div>
          )}
          {people.data?.length ? (
            <ul className="pb-6">
              {people.data.map((u) => (
                <UserRow key={u.id} user={u}
                  sub={'commonArtists' in u && (u as { commonArtists: number }).commonArtists ? `같은 아티스트 ${(u as { commonArtists: number }).commonArtists}명 · ${u.bio || '소개글 없음'}` : undefined}
                  right={<>
                    <Button size="sm" variant="secondary" onClick={() => nav(`/profile/${u.id}`)}>프로필</Button>
                    <Button size="sm" onClick={() => actions.request(u.id)}>친구 요청</Button>
                  </>} />
              ))}
            </ul>
          ) : <Empty title={people.isLoading ? '찾는 중…' : '아직 추천할 덕친이 없어요'} />}
        </>
      )}

      <Sheet open={filterOpen} onClose={() => setFilterOpen(false)} title="검색 범주">
        <div className="max-h-[50vh] overflow-y-auto px-5 pb-3">
          <p className="pb-1 pt-1 t-sub font-semibold text-graphite">장르</p>
          <div className="flex flex-wrap gap-2">
            {genres.map((g) => (
              <button key={g.id} aria-pressed={filter.genreId === g.id} onClick={() => { setFilter({ genreId: g.id }); setFilterOpen(false) }}
                className={`h-9 rounded-full px-3.5 t-sub ${filter.genreId === g.id ? 'bg-ink font-semibold text-paper' : 'bg-mist'}`}>{g.name}</button>
            ))}
          </div>
          <p className="pb-1 pt-4 t-sub font-semibold text-graphite">아티스트</p>
          <div className="flex flex-wrap gap-2">
            {artists.slice(0, 40).map((a) => (
              <button key={a.id} aria-pressed={filter.artistId === a.id} onClick={() => { setFilter({ artistId: a.id }); setFilterOpen(false) }}
                className={`h-9 rounded-full px-3.5 t-sub ${filter.artistId === a.id ? 'bg-ink font-semibold text-paper' : 'bg-mist'}`}>{a.name}</button>
            ))}
          </div>
        </div>
      </Sheet>
    </>
  )
}
