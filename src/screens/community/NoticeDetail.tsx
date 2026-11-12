import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorText } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { Confirm } from '@/components/ui/Confirm'
import { Empty } from '@/components/ui/Empty'
import { fmtDateTime } from '@/lib/date'
import { keys, useMe } from '@/lib/queries'
import { toast } from '@/store/ui'

// 공지 상세. 운영자에게만 삭제 버튼
export default function NoticeDetail() {
  const id = useParams().id ?? ''
  const nav = useNavigate()
  const qc = useQueryClient()
  const admin = useMe().data?.isAdmin
  const n = useQuery({ queryKey: keys.notice(id), queryFn: () => api.getNotice(id) })
  const [del, setDel] = useState(false)

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader back title="공지" right={admin && n.data && <button onClick={() => setDel(true)} className="h-11 px-4 t-body font-semibold text-notice">삭제</button>} />
      {n.data ? (
        <article className="px-5 pb-8 pt-1">
          <h1 className="t-title">{n.data.title}</h1>
          <p className="mt-1 t-cap text-graphite">운영팀 · {fmtDateTime(n.data.startsAt)}{new Date(n.data.startsAt).getTime() > Date.now() && ' 공개 예약'}</p>
          <p className="mt-4 whitespace-pre-wrap t-body">{n.data.body}</p>
        </article>
      ) : <Empty title={n.isLoading ? '불러오는 중…' : '사라진 공지예요'} />}
      <Confirm open={del} title="공지를 삭제할까요?" message="삭제하면 되돌릴 수 없어요." confirmLabel="삭제" danger onClose={() => setDel(false)}
        onConfirm={async () => {
          setDel(false)
          try { await api.adminDeleteNotice(id); await qc.invalidateQueries({ queryKey: keys.notices }); toast('공지를 삭제했어요'); nav(-1) } catch (e) { toast(errorText(e)) }
        }} />
    </div>
  )
}
