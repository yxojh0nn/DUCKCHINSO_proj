import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorText } from '@/api'
import { AppHeader, HeaderButton } from '@/components/AppHeader'
import { ReportSheet } from '@/components/ReportSheet'
import { IconComment, IconMore, IconSend, IconUp } from '@/components/icons'
import { Avatar } from '@/components/ui/Avatar'
import { Confirm } from '@/components/ui/Confirm'
import { Empty } from '@/components/ui/Empty'
import { Sheet } from '@/components/ui/Sheet'
import { useFriendActions } from '@/lib/actions'
import { fmtRelative } from '@/lib/date'
import { keys, useMe } from '@/lib/queries'
import { toast } from '@/store/ui'

// 글 상세: 왼쪽 위 작성자, 오른쪽 위 점 세 개(친구 요청·프로필·신고), 추천·댓글
export default function PostDetail() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const qc = useQueryClient()
  const me = useMe().data
  const post = useQuery({ queryKey: keys.post(id), queryFn: () => api.getPost(id) })
  const comments = useQuery({ queryKey: keys.comments(id), queryFn: () => api.listComments(id) })
  const actions = useFriendActions()
  const [menu, setMenu] = useState(false)
  const [report, setReport] = useState<{ postId?: string; commentId?: string; userId?: string } | null>(null)
  const [del, setDel] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)

  if (post.isError) return (<><AppHeader back /><Empty title="글을 볼 수 없어요" body="삭제됐거나 볼 수 없는 글이에요." /></>)
  const p = post.data
  const mine = p && me && p.author.id === me.id

  const like = async () => {
    try {
      await api.toggleLike(id)
      await Promise.all([qc.invalidateQueries({ queryKey: keys.post(id) }), qc.invalidateQueries({ queryKey: ['posts'] })])
    } catch (e) { toast(errorText(e)) }
  }
  const comment = async (e: React.FormEvent) => {
    e.preventDefault()
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    try {
      await api.addComment(id, body)
      setText('')
      await Promise.all([qc.invalidateQueries({ queryKey: keys.comments(id) }), qc.invalidateQueries({ queryKey: keys.post(id) })])
    } catch (err) { toast(errorText(err)) } finally { setSending(false) }
  }

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader back title={p && (
        <Link to={`/profile/${p.author.id}`} className="flex items-center gap-2">
          <Avatar url={p.author.avatarUrl} name={p.author.nickname} size={26} />
          <span className="max-w-[180px] truncate t-sub font-semibold">{p.author.nickname}</span>
        </Link>
      )} right={p && <HeaderButton label="더보기" onClick={() => setMenu(true)}><IconMore /></HeaderButton>} />

      {p && (
        <article className="px-5 pt-3">
          <h1 className="t-title">{p.title}</h1>
          <p className="mt-1 t-cap text-graphite">{fmtRelative(p.createdAt)}</p>
          <p className="mt-4 whitespace-pre-wrap t-body">{p.body}</p>
          {p.imageUrls.map((u) => <img key={u} src={u} alt="첨부 사진" className="mt-3 w-full rounded-[12px] bg-mist" />)}
          {p.tags.length > 0 && <p className="mt-4 t-sub text-graphite">{p.tags.map((t) => `#${t}`).join(' ')}</p>}
          <div className="mt-4 flex items-center gap-5 border-b border-hairline pb-3">
            <button onClick={like} aria-pressed={p.likedByMe} className={`flex h-10 items-center gap-1 t-sub font-semibold ${p.likedByMe ? 'text-ink' : 'text-graphite'}`}>
              <IconUp size={20} filled={p.likedByMe} strokeWidth={p.likedByMe ? 2.4 : 1.7} />추천 {p.likeCount}
            </button>
            <span className="flex items-center gap-1 t-sub text-graphite"><IconComment size={18} />댓글 {comments.data?.length ?? p.commentCount}</span>
          </div>
        </article>
      )}

      <ul className="flex-1 pb-4">
        {comments.data?.map((c) => (
          <li key={c.id} className="flex gap-3 px-5 py-3">
            <Link to={`/profile/${c.author.id}`}><Avatar url={c.author.avatarUrl} name={c.author.nickname} size={32} /></Link>
            <div className="min-w-0 flex-1">
              <p className="t-sub"><span className="font-semibold">{c.author.nickname}</span> <span className="text-graphite">{fmtRelative(c.createdAt)}</span></p>
              <p className="mt-0.5 whitespace-pre-wrap t-body">{c.body}</p>
            </div>
            {me && c.author.id !== me.id && (
              <button onClick={() => setReport({ commentId: c.id })} className="h-8 self-start t-cap text-graphite">신고</button>
            )}
          </li>
        ))}
      </ul>

      <form onSubmit={comment} className="sticky bottom-0 flex items-center gap-2 border-t border-hairline bg-paper px-4 py-2 pb-[max(8px,env(safe-area-inset-bottom))]">
        <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="댓글 남기기" aria-label="댓글"
          className="h-10 flex-1 rounded-full bg-mist px-4 outline-none t-body" />
        <button type="submit" disabled={!text.trim() || sending} aria-label="댓글 보내기" className="disabled:opacity-30"><IconSend size={34} /></button>
      </form>

      <Sheet open={menu} onClose={() => setMenu(false)} actions={p ? (mine ? [
        { label: '글 삭제', danger: true, onClick: () => { setMenu(false); setDel(true) } },
      ] : [
        { label: '친구 요청 보내기', onClick: () => { setMenu(false); actions.request(p.author.id) } },
        { label: '상세 프로필 보기', onClick: () => nav(`/profile/${p.author.id}`) },
        { label: '신고하기', danger: true, onClick: () => { setMenu(false); setReport({ postId: p.id }) } },
      ]) : []} />
      <ReportSheet open={!!report} target={report ?? {}} onClose={() => setReport(null)} />
      <Confirm open={del} title="글을 삭제할까요?" message="삭제하면 되돌릴 수 없어요." confirmLabel="삭제" danger onClose={() => setDel(false)}
        onConfirm={async () => {
          try { await api.deletePost(id); await qc.invalidateQueries({ queryKey: ['posts'] }); toast('글을 삭제했어요'); nav(-1) } catch (e) { toast(errorText(e)) }
        }} />
    </div>
  )
}
