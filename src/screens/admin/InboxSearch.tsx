import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorText } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { IconSearch } from '@/components/icons'
import { Button } from '@/components/ui/Button'
import { Empty } from '@/components/ui/Empty'
import { toast } from '@/store/ui'
import { adminKeys } from './AdminGate'

const STATUS = { published: '게시됨', review: '검수 대기', hidden: '숨김' } as const
const day = (d: string | null) => d ? d.slice(5).replace('-', '.') : ''

// 공연 찾기: 수집한 KOPIS 목록 전체에서 검색해 가져온다 (자동 판별에서 후보에도 못 오른 공연용)
export default function InboxSearch() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const [input, setInput] = useState('')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const list = useQuery({ queryKey: adminKeys.inbox(q), queryFn: () => api.adminSearchInbox(q), enabled: !!q })

  const take = async (kopisId: string) => {
    setBusy(kopisId)
    try {
      const id = await api.adminImportConcert(kopisId)
      await qc.invalidateQueries({ queryKey: ['admin'] })
      nav(`/admin/concerts/${id}`)
    } catch (e) { toast(errorText(e)) } finally { setBusy(null) }
  }

  return (
    <>
      <AppHeader back title="공연 찾기" />
      <form className="px-5 pt-1" onSubmit={(e) => { e.preventDefault(); setQ(input.trim()) }}>
        <label className="flex h-10 items-center gap-2 rounded-[10px] bg-mist px-3">
          <IconSearch size={18} className="text-graphite" />
          <input value={input} onChange={(e) => setInput(e.target.value)} enterKeyHint="search" placeholder="공연명 (예: Regallily, 유우리)"
            aria-label="수집한 공연 검색" className="h-full min-w-0 flex-1 outline-none t-body" />
        </label>
      </form>
      {!q ? <Empty title="공연명으로 검색하세요" body="최근 수집한 대중음악 공연 전체에서 찾아요." />
        : list.data?.length ? (
          <ul className="pb-8 pt-2">
            {list.data.map((it) => (
              <li key={it.kopisId} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 t-body font-semibold">{it.title}</p>
                  <p className="mt-0.5 truncate t-sub text-graphite num">{day(it.startDate)}{it.endDate && it.endDate !== it.startDate ? ` ~ ${day(it.endDate)}` : ''} · {it.venue}</p>
                </div>
                {it.concert
                  ? <Link to={`/admin/concerts/${it.concert.id}`} className="shrink-0 t-sub font-semibold">{STATUS[it.concert.status]}</Link>
                  : <Button size="sm" disabled={!!busy} onClick={() => take(it.kopisId)}>{busy === it.kopisId ? '가져오는 중…' : '가져오기'}</Button>}
              </li>
            ))}
          </ul>
        ) : <Empty title={list.isLoading ? '찾는 중…' : '맞는 공연이 없어요'} />}
    </>
  )
}
