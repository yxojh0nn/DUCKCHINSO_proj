import { useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, type Recommended } from '@/api'
import { AppHeader, HeaderButton } from '@/components/AppHeader'
import { PostRow } from '@/components/PostRow'
import { UserRow } from '@/components/UserRow'
import { PastConcerts } from './PastConcerts'
import { IconFilter, IconPlus, IconRequests } from '@/components/icons'
import { SearchField } from '@/components/ui/Field'
import { Badge } from '@/components/ui/Badge'
import { Button, Chip } from '@/components/ui/Button'
import { Empty } from '@/components/ui/Empty'
import { Sheet } from '@/components/ui/Sheet'
import { TextTabs } from '@/components/ui/TextTabs'
import { useFriendActions } from '@/lib/actions'
import { fmtDateTime, fmtRelative } from '@/lib/date'
import { keys, useArtists, useGenres, useMe, useNotices, useRequests } from '@/lib/queries'

type Filter = { genreId?: number; artistId?: string }

// 커뮤니티 탭: 상단 검색·친구 요청함, 아래 전체 글(기본) / 공지 / 공연 후기(지난 공연) / 덕친 찾기(범주 설정)
export default function Community() {
  const nav = useNavigate()
  const me = useMe()
  // 보던 하위 탭을 주소에 남겨서 프로필을 보고 돌아와도 유지
  const [params, setParams] = useSearchParams()
  const t0 = params.get('tab')
  const tab = t0 === 'friends' || t0 === 'reviews' || t0 === 'notice' ? t0 : 'feed'
  const setTab = (t: 'feed' | 'notice' | 'reviews' | 'friends') => setParams(t === 'feed' ? {} : { tab: t }, { replace: true })
  const [q, setQ] = useState(() => params.get('q') ?? '') // 공연 상세 "이 공연 이야기 보기"가 ?q= 로 연다
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
    enabled: tab === 'friends' && me.data?.isGuest === false, // 사용자 검색·추천은 회원만 (서버도 막는다)
  })
  const notices = (useNotices().data ?? []).filter((n) => !term || n.title.includes(term) || n.body.includes(term))

  // 규칙 동의 뒤 같은 검색어(?q=, "이 공연 이야기 보기")로 돌아오도록 주소 뒤를 넘긴다
  if (me.data && !me.data.communityAgreedAt) return <Navigate to={`/community/rules?${params}`} replace />
  if (me.data && !me.data.profileSetupDone) return <Navigate to="/community/setup" replace />

  const filterLabel = filter.genreId ? genres.find((g) => g.id === filter.genreId)?.name
    : filter.artistId ? artists.find((a) => a.id === filter.artistId)?.name : null

  return (
    <>
      <AppHeader large title="커뮤니티" right={<>
        {tab === 'feed' && !me.data?.isGuest && <Link to="/community/write" className="mr-1 hidden h-9 md:flex items-center whitespace-nowrap rounded-[10px] bg-ink px-3.5 t-sub font-semibold text-paper active:opacity-70">글쓰기</Link>}
        <HeaderButton label={`대기 중인 친구 요청 ${incoming}개`} onClick={() => nav('/community/requests')}>
          <IconRequests />
          <Badge count={incoming} className="absolute right-0.5 top-1" />
        </HeaderButton>
      </>} />
      <div className={`flex items-center gap-1 pl-5 ${tab === 'friends' ? 'pr-2' : 'pr-5'}`}>
        <SearchField className="flex-1" clearable value={q} onValue={setQ} label="검색어"
          placeholder={tab === 'feed' ? '글 제목, 내용, 태그' : tab === 'notice' ? '공지 제목, 내용' : tab === 'reviews' ? '지난 공연 검색' : '닉네임이나 소개글 키워드'} />
        {/* 범주(장르·아티스트)는 덕친 찾기에만 있다 → 그 탭에서만 보인다 (다른 탭에서 누르면 몰래 탭이 바뀌던 문제) */}
        {tab === 'friends' && (
          <HeaderButton label={filtered ? '검색 범주 설정 (적용 중)' : '검색 범주 설정'} onClick={() => setFilterOpen(true)}>
            <IconFilter />
            {filtered && <span className="absolute right-2 top-2.5 h-2 w-2 rounded-full bg-notice" />}
          </HeaderButton>
        )}
      </div>
      <div className="mt-1 border-b border-hairline">
        <TextTabs label="커뮤니티 보기" value={tab} onChange={setTab} tabs={[{ value: 'feed', label: '전체 글' }, { value: 'notice', label: '공지' }, { value: 'reviews', label: '공연 후기' }, { value: 'friends', label: '덕친 찾기' }]} />
      </div>

      {me.data?.isGuest && <p className="px-5 pt-3 t-sub text-graphite">비회원은 읽기만 할 수 있어요. 글·댓글·추천·덕친 찾기는 회원으로 로그인하면 쓸 수 있어요.</p>}
      {tab === 'notice' ? (
        notices.length ? (
          <ul className="pb-6">
            {notices.map((n) => (
              <li key={n.id} className="border-b border-hairline last:border-0">
                <Link to={`/community/notice/${n.id}`} className="block px-5 py-4 active:bg-mist">
                  <p className="truncate t-body font-semibold">{n.title}</p>
                  <p className="mt-0.5 line-clamp-2 t-sub text-graphite">{n.body}</p>
                  <p className="mt-1.5 t-cap text-graphite num">운영팀 · {new Date(n.startsAt).getTime() > Date.now() ? `${fmtDateTime(n.startsAt)} 공개 예약` : fmtRelative(n.startsAt)}</p>
                </Link>
              </li>
            ))}
          </ul>
        ) : <Empty title={term ? '맞는 공지가 없어요' : '아직 공지가 없어요'} />
      ) : tab === 'reviews' ? <PastConcerts q={term} /> : tab === 'feed' ? (
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
                  sub={'commonArtists' in u ? recSub(u as Recommended) : undefined}
                  right={<>
                    <Button size="sm" variant="secondary" onClick={() => nav(`/profile/${u.id}`)}>프로필</Button>
                    <Button size="sm" onClick={() => actions.ask(u)}>친구 요청</Button>
                  </>} />
              ))}
            </ul>
          ) : <Empty title={me.data?.isGuest ? '덕친 찾기는 회원만 쓸 수 있어요' : people.isLoading ? '찾는 중…' : '아직 추천할 덕친이 없어요'} />}
        </>
      )}

      <Sheet open={filterOpen} onClose={() => setFilterOpen(false)} title="검색 범주">
        <div className="max-h-[50vh] overflow-y-auto px-5 pb-3">
          <p className="pb-1 pt-1 t-sub font-semibold text-graphite">장르</p>
          <div className="flex flex-wrap gap-2">
            {genres.map((g) => (
              <Chip key={g.id} on={filter.genreId === g.id} onClick={() => { setFilter({ genreId: g.id }); setFilterOpen(false) }}>{g.name}</Chip>
            ))}
          </div>
          <p className="pb-1 pt-4 t-sub font-semibold text-graphite">아티스트</p>
          <div className="flex flex-wrap gap-2">
            {artists.slice(0, 40).map((a) => (
              <Chip key={a.id} on={filter.artistId === a.id} onClick={() => { setFilter({ artistId: a.id }); setFilterOpen(false) }}>{a.name}</Chip>
            ))}
          </div>
        </div>
      </Sheet>
      {/* 휴대폰: 엄지가 닿는 오른쪽 아래에 글쓰기 (하단 탭 바로 위) */}
      {tab === 'feed' && me.data && !me.data.isGuest && (
        <Link to="/community/write" className="fixed bottom-[calc(68px+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 items-center gap-1.5 rounded-full bg-ink pl-4 pr-5 t-head text-paper shadow-[0_6px_20px_rgba(0,0,0,0.22)] active:opacity-80 md:hidden">
          <IconPlus size={20} />글쓰기
        </Link>
      )}
      {actions.dialog}
    </>
  )
}

// 추천 줄 아래 설명: 지역 · 같은 아티스트 수 · 소개글
const recSub = (u: Recommended) =>
  [u.region, u.commonArtists ? `같은 아티스트 ${u.commonArtists}명` : '', u.bio || '소개글 없음'].filter(Boolean).join(' · ')
