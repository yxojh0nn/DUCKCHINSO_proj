import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import { api } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { IconSearch } from '@/components/icons'
import { LoadMore } from '@/components/LoadMore'
import { Empty } from '@/components/ui/Empty'
import { adminKeys } from './AdminGate'

// 아티스트: 전체 목록(스크롤 끝에서 40명씩 더) 또는 검색 → 별칭 추가·이름 수정, 또는 새로 추가. 운영자가 손본 아티스트는 MusicBrainz 수집이 덮어쓰지 않는다
export default function Artists() {
  const nav = useNavigate()
  const [input, setInput] = useState('')
  const [q, setQ] = useState('')
  const list = useInfiniteQuery({
    queryKey: adminKeys.artists(q),
    queryFn: ({ pageParam }) => api.adminSearchArtists(q, pageParam),
    initialPageParam: 0,
    getNextPageParam: (last, all) => (last.length === 40 ? all.length : undefined),
  })
  const artists = list.data?.pages.flat() ?? []
  return (
    <>
      <AppHeader back title="아티스트" right={
        <button onClick={() => nav('/admin/artists/new')} className="flex h-11 items-center px-3 t-body font-semibold">추가</button>
      } />
      <form className="px-5 pt-1" onSubmit={(e) => { e.preventDefault(); setQ(input.trim()) }}>
        <label className="flex h-10 items-center gap-2 rounded-[10px] bg-mist px-3">
          <IconSearch size={18} className="text-graphite" />
          <input value={input} onChange={(e) => setInput(e.target.value)} enterKeyHint="search" placeholder="한국어·일본어·영문 이름"
            aria-label="아티스트 검색" className="h-full min-w-0 flex-1 outline-none t-body" />
        </label>
      </form>
      {artists.length ? (<>
        <ul className="pb-8 pt-2">
          {artists.map((a) => (
            <li key={a.id}>
              <Link to={`/admin/artists/${a.id}`} className="flex min-h-[56px] flex-col justify-center px-5 py-2 active:bg-mist">
                <span className="t-body font-semibold">{a.name}{a.source === 'admin' && <span className="ml-2 t-cap font-medium text-graphite">관리자 수정</span>}</span>
                <span className="truncate t-sub text-graphite">{[a.nameJa, a.nameEn, ...a.aliases.slice(0, 3)].filter(Boolean).join(' · ')}</span>
              </Link>
            </li>
          ))}
        </ul>
        {list.hasNextPage && <LoadMore key={artists.length} loading={list.isFetchingNextPage} onMore={() => !list.isFetchingNextPage && list.fetchNextPage()} />}
      </>) : <Empty title={list.isLoading ? '불러오는 중…' : '맞는 아티스트가 없어요'} action={!list.isLoading && <Link to="/admin/artists/new" className="t-body font-semibold underline underline-offset-4">새로 추가하기</Link>} />}
    </>
  )
}
