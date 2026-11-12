import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api, type AdminUser } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { Button } from '@/components/ui/Button'
import { Empty } from '@/components/ui/Empty'
import { TextField } from '@/components/ui/Field'
import { TextTabs } from '@/components/ui/TextTabs'
import { fmtRelative } from '@/lib/date'
import { adminKeys } from './AdminGate'

const PAGE = 50
const LOGIN: Record<string, string> = { guest: '비회원', email: '아이디', kakao: '카카오', naver: '네이버', google: 'Google', apple: 'Apple' }
export const LOGIN_LABEL = (l: string) => l.split(',').map((x) => LOGIN[x] ?? x).join('·')
const STATUS: Record<AdminUser['status'], string> = { active: '', suspended: '이용 제한', banned: '정지' }
const day = (iso: string) => new Date(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })

// 전체 사용자: 요약 · 회원/비회원 칸(기본 회원) · 닉네임 검색 · 최근 가입순 50명씩 → 누르면 사용자 상세(바로 제재). 이메일 등 개인정보는 보여 주지 않는다
export default function AdminUsers() {
  const [input, setInput] = useState('')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const [kind, setKind] = useState<'member' | 'guest'>('member')
  const guests = kind === 'guest'
  useEffect(() => { const t = setTimeout(() => { setQ(input.trim()); setPage(0) }, 300); return () => clearTimeout(t) }, [input])
  const stats = useQuery({ queryKey: adminKeys.userStats, queryFn: () => api.adminUserStats() })
  const list = useQuery({ queryKey: adminKeys.users(q, page, guests), queryFn: () => api.adminUsers(q, page, guests), placeholderData: keepPreviousData })
  const total = list.data?.total ?? 0
  const s = stats.data

  return (
    <>
      <AppHeader back title="전체 사용자" />
      {s && (
        <dl className="grid grid-cols-5 gap-1 border-b border-hairline px-5 py-4 text-center">
          {([['회원', s.members], ['비회원', s.guests], ['7일 접속', s.active7d], ['이용 제한', s.suspended], ['정지', s.banned]] as const).map(([k, v]) => (
            <div key={k}><dt className="t-cap text-graphite">{k}</dt><dd className="mt-0.5 t-head num">{v.toLocaleString('ko-KR')}</dd></div>
          ))}
        </dl>
      )}
      <div className="border-b border-hairline">
        <TextTabs label="사용자 구분" value={kind} onChange={(k) => { setKind(k); setPage(0) }}
          tabs={[{ value: 'member', label: '회원' }, { value: 'guest', label: '비회원' }]} />
      </div>
      <div className="px-5 pt-3">
        <TextField label="닉네임 검색" value={input} onChange={(e) => setInput(e.target.value)} maxLength={20}
          hint={list.data ? `${total.toLocaleString('ko-KR')}명` : undefined} />
      </div>
      {list.data?.users.length ? (
        <ul className="pb-4 pt-2">
          {list.data.users.map((u) => (
            <li key={u.id}>
              <Link to={`/admin/users/${u.id}`} className="block px-5 py-3 active:bg-mist">
                <p className="flex items-center gap-2 t-body">
                  <span className="min-w-0 truncate font-semibold">{u.nickname}</span>
                  {u.isAdmin && <span className="shrink-0 t-cap font-semibold text-success">관리자</span>}
                  {STATUS[u.status] && <span className="shrink-0 t-cap font-semibold text-danger">{STATUS[u.status]}</span>}
                  <span className="ml-auto shrink-0 t-sub text-graphite">{LOGIN_LABEL(u.login)}</span>
                </p>
                <p className="mt-0.5 t-cap text-graphite">
                  가입 {day(u.createdAt)} · 최근 접속 {fmtRelative(u.lastSeenAt)}{u.sanctions ? ` · 제재 ${u.sanctions}회` : ''}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : <Empty title={list.isLoading ? '불러오는 중…' : '맞는 사용자가 없어요'} />}
      {total > PAGE && (
        <div className="flex items-center justify-between px-5 pb-8">
          <Button size="sm" variant="secondary" disabled={page === 0} onClick={() => setPage(page - 1)}>이전</Button>
          <span className="t-sub text-graphite num">{page + 1} / {Math.ceil(total / PAGE)}</span>
          <Button size="sm" variant="secondary" disabled={(page + 1) * PAGE >= total} onClick={() => setPage(page + 1)}>다음</Button>
        </div>
      )}
    </>
  )
}
