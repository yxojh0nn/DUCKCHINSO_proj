import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { Empty } from '@/components/ui/Empty'
import { fmtDateTime, fmtRelative } from '@/lib/date'
import { adminKeys } from './AdminGate'
import { LOGIN_LABEL } from './AdminUsers'
import { SanctionPanel } from './SanctionPanel'

const STATUS = { active: '정상', suspended: '이용 제한 중', banned: '영구 제한' } as const
const LEVEL = { warning: '경고', suspend: '이용 제한', ban: '영구 제한' } as const

// 사용자 한 명: 기본 정보 · 활동 수 · 제재 이력 → 바로 제재
export default function AdminUserDetail() {
  const { id = '' } = useParams()
  const q = useQuery({ queryKey: adminKeys.user(id), queryFn: () => api.adminUser(id) })
  const d = q.data
  const u = d?.user
  if (!d || !u) return <><AppHeader back title="사용자" />{q.isFetched && <Empty title="사용자를 찾을 수 없어요" body="탈퇴했거나 비회원 정리로 지워졌을 수 있어요." />}</>

  const rows: [string, React.ReactNode][] = [
    ['상태', <span className={u.status === 'active' ? '' : 'font-semibold text-danger'}>{STATUS[u.status]}</span>],
    ['로그인', LOGIN_LABEL(u.login)],
    ['가입', fmtDateTime(u.createdAt)],
    ['최근 접속', fmtRelative(u.lastSeenAt)],
    ['활동', `글 ${u.posts} · 댓글 ${u.comments} · 받은 신고 ${u.reportsAgainst}`],
  ]
  return (
    <div className="pb-10">
      <AppHeader back title="사용자" />
      <section className="px-5 pt-2">
        <h1 className="flex items-center gap-2 t-title">
          {u.nickname}{u.isAdmin && <span className="t-sub font-semibold text-success">관리자</span>}
        </h1>
        {u.bio && <p className="mt-1 t-body text-graphite">{u.bio}</p>}
        <Link to={`/profile/${u.id}`} className="mt-1 inline-flex h-9 items-center t-sub font-semibold underline underline-offset-4">프로필 보기</Link>
        <dl className="mt-3 space-y-1.5 t-sub">
          {rows.map(([k, v]) => <div key={k} className="flex gap-3"><dt className="w-16 shrink-0 text-graphite">{k}</dt><dd>{v}</dd></div>)}
        </dl>
      </section>

      <section className="mt-6 px-5">
        <h2 className="t-head">제재 이력</h2>
        {d.sanctions.length ? (
          <ul className="mt-2 space-y-2">
            {d.sanctions.map((s, i) => (
              <li key={i} className="t-sub">
                <b className={s.level === 'warning' ? '' : 'text-danger'}>{LEVEL[s.level]}</b>
                <span className="text-graphite"> · {fmtDateTime(s.startsAt)}{s.endsAt ? ` ~ ${fmtDateTime(s.endsAt)}` : ''}</span>
                <p className="text-graphite">{s.reason}</p>
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 t-sub text-graphite">없어요</p>}
      </section>

      {/* 운영자·영구 제한된 사람은 제재할 수 없다 (DB 도 막는다) */}
      {!u.isAdmin && u.status !== 'banned' && <SanctionPanel target={u} title="바로 제재" />}
    </div>
  )
}
