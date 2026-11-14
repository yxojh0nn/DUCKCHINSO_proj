import { useState } from 'react'
import type { Comment } from '@/api'
import { useConcerts } from '@/lib/queries'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorText } from '@/api'
import { AppHeader, HeaderButton } from '@/components/AppHeader'
import { REPORT_REASONS, ReportSheet } from '@/components/ReportSheet'
import { IconAdmin, IconComment, IconMore, IconSend, IconUp } from '@/components/icons'
import { Avatar } from '@/components/ui/Avatar'
import { Confirm } from '@/components/ui/Confirm'
import { Empty } from '@/components/ui/Empty'
import { Sheet } from '@/components/ui/Sheet'
import { useFriendActions } from '@/lib/actions'
import { fmtRelative } from '@/lib/date'
import { keys, useAdminIds, useMe } from '@/lib/queries'
import { toast } from '@/store/ui'

// 글 상세: 제목 위 작성자, 오른쪽 위 점 세 개(친구 요청·프로필·신고), 추천·댓글
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
  const [adminPick, setAdminPick] = useState(false) // 운영자 삭제: 사유 고르기
  const [adminWhy, setAdminWhy] = useState<string | null>(null) // 고른 사유 → 확인
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<{ parentId: string; userId: string; nickname: string } | null>(null) // 답글 대상
  const [sending, setSending] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null) // 내 댓글 수정 중
  const adminIds = useAdminIds()

  if (post.isError) return (<><AppHeader back /><Empty title="글을 볼 수 없어요" body="삭제됐거나 볼 수 없는 글이에요." /></>)
  const p = post.data
  const mine = p && me && p.author.id === me.id

  const like = async () => {
    if (me?.isGuest) return toast(errorText('members_only')) // 서버 toggle_post_like 도 막는다
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
      if (editingId) await api.editComment(editingId, body)
      else await api.addComment(id, body, replyTo ? { parentId: replyTo.parentId, toUserId: replyTo.userId } : undefined)
      setText('')
      setEditingId(null)
      setReplyTo(null)
      await Promise.all([qc.invalidateQueries({ queryKey: keys.comments(id) }), qc.invalidateQueries({ queryKey: keys.post(id) })])
    } catch (err) { toast(errorText(err)) } finally { setSending(false) }
  }

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader back right={p && <HeaderButton label="더보기" onClick={() => setMenu(true)}><IconMore /></HeaderButton>} />

      {p && (
        <article className="px-5 pt-1">
          <Link to={`/profile/${p.author.id}`} className="mb-3 flex w-fit max-w-full items-center gap-2">
            <Avatar url={p.author.avatarUrl} name={p.author.nickname} size={32} />
            <span className="truncate t-sub font-semibold">{p.author.nickname}</span>
            {adminIds.includes(p.author.id) && <span className="shrink-0 t-cap font-semibold text-success">관리자</span>}
          </Link>
          <h1 className="t-title">{p.title}</h1>
          <p className="mt-1 t-cap text-graphite">{fmtRelative(p.createdAt)}{p.edited && ' · 수정됨'}</p>
          <p className="mt-4 whitespace-pre-wrap t-body">{p.body}</p>
          {p.imageUrls.map((u) => <img key={u} src={u} alt="첨부 사진" className="mt-3 w-full rounded-[12px] bg-mist" />)}
          {p.tags.length > 0 && <p className="mt-4 t-sub text-graphite">{p.tags.map((t) => `#${t}`).join(' ')}</p>}
          {p.concertId && <PostConcert id={p.concertId} />}
          <div className="mt-4 flex items-center gap-5 border-b border-hairline pb-3">
            <button onClick={like} aria-pressed={p.likedByMe} className={`flex h-10 items-center gap-1 t-sub font-semibold ${p.likedByMe ? 'text-ink' : 'text-graphite'}`}>
              <IconUp size={20} filled={p.likedByMe} strokeWidth={p.likedByMe ? 2.4 : 1.7} />추천 {p.likeCount}
            </button>
            <span className="flex items-center gap-1 t-sub text-graphite"><IconComment size={18} />댓글 {comments.data?.length ?? p.commentCount}</span>
          </div>
        </article>
      )}

      <ul className="flex-1 pb-4">
        {/* 원 댓글 아래에 답글을 시간순으로. 답글은 들여 쓰고 누구에게 단 답글인지 @닉네임으로 보인다 */}
        {threaded(comments.data ?? []).map((c) => (
          <li key={c.id} className={`flex gap-3 py-3 pr-5 ${c.parentId ? 'pl-14' : 'pl-5'}`}>
            <Link to={`/profile/${c.author.id}`}><Avatar url={c.author.avatarUrl} name={c.author.nickname} size={c.parentId ? 26 : 32} /></Link>
            <div className="min-w-0 flex-1">
              <p className="t-sub"><span className="font-semibold">{c.author.nickname}</span>{adminIds.includes(c.author.id) && <span className="ml-1 t-cap font-semibold text-success">관리자</span>} <span className="text-graphite">{fmtRelative(c.createdAt)}{c.edited && ' · 수정됨'}</span></p>
              <p className="mt-0.5 whitespace-pre-wrap t-body">
                {c.replyTo && <span className="mr-1 font-semibold text-graphite">@{c.replyTo.nickname}</span>}{c.body}
              </p>
              {me && !me.isGuest && (
                <button onClick={() => { setEditingId(null); setReplyTo({ parentId: c.parentId ?? c.id, userId: c.author.id, nickname: c.author.nickname }); document.getElementById('comment-input')?.focus() }}
                  className="-ml-2 mt-0.5 h-11 px-2 t-sub font-semibold text-graphite">답글</button>
              )}
              {me && c.author.id === me.id && (
                <button onClick={() => { setEditingId(c.id); setReplyTo(null); setText(c.body); document.getElementById('comment-input')?.focus() }}
                  className="mt-0.5 h-11 px-2 t-sub font-semibold text-graphite">수정</button>
              )}
            </div>
            {me && c.author.id !== me.id && (
              <button onClick={() => setReport({ commentId: c.id })} className="-mr-2 -mt-2 h-11 self-start px-2 t-sub text-graphite">신고</button>
            )}
          </li>
        ))}
      </ul>

      {me?.isGuest ? (
        <p className="sticky bottom-0 border-t border-hairline bg-paper px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))] t-sub text-graphite">댓글·추천은 회원으로 로그인하면 쓸 수 있어요.</p>
      ) : (
      <form onSubmit={comment} className="sticky bottom-0 border-t border-hairline bg-paper px-4 py-2 pb-[max(8px,env(safe-area-inset-bottom))]">
        {editingId && (
          <p className="flex items-center gap-2 pb-1.5 pl-1 t-sub text-graphite">
            <span className="min-w-0 flex-1 truncate">댓글 수정 중</span>
            <button type="button" onClick={() => { setEditingId(null); setText('') }} className="h-8 px-2 font-semibold">취소</button>
          </p>
        )}
        {replyTo && (
          <p className="flex items-center gap-2 pb-1.5 pl-1 t-sub text-graphite">
            <span className="min-w-0 flex-1 truncate"><b className="text-ink">@{replyTo.nickname}</b> 님에게 답글</span>
            <button type="button" onClick={() => setReplyTo(null)} className="h-8 px-2 font-semibold">취소</button>
          </p>
        )}
        <div className="flex items-center gap-2">
        <input id="comment-input" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder={editingId ? '댓글 수정' : replyTo ? '답글 남기기' : '댓글 남기기'} aria-label={replyTo ? '답글' : '댓글'}
          className="h-10 flex-1 rounded-full bg-mist px-4 outline-none t-body" />
        <button type="submit" disabled={!text.trim() || sending} aria-label="댓글 보내기" className="disabled:opacity-30"><IconSend size={34} /></button>
        </div>
      </form>
      )}

      <Sheet open={menu} onClose={() => setMenu(false)} actions={p ? (mine ? [
        { label: '글 수정', onClick: () => { setMenu(false); nav(`/community/write?edit=${p.id}`) } },
        { label: '글 삭제', danger: true, onClick: () => { setMenu(false); setDel(true) } },
      ] : [
        ...(me?.isGuest ? [] : [{ label: '친구 요청 보내기', onClick: () => { setMenu(false); actions.ask(p.author) } }]),
        { label: '상세 프로필 보기', onClick: () => nav(`/profile/${p.author.id}`) },
        { label: '신고하기', danger: true, onClick: () => { setMenu(false); setReport({ postId: p.id }) } },
        // 운영자 권한: 신고 없이 바로 삭제 (DB 함수가 운영자인지 다시 확인한다)
        ...(me?.isAdmin ? [{ label: '삭제하기', note: '관리자 권한', danger: true, icon: <IconAdmin size={20} />, onClick: () => { setMenu(false); setAdminPick(true) } }] : []),
      ]) : []} />
      <Sheet open={adminPick} onClose={() => setAdminPick(false)} title="삭제 사유" message="작성자에게 운영팀 대화방으로 사유와 함께 알려요."
        actions={REPORT_REASONS.map((r) => ({ label: r.label, onClick: () => { setAdminPick(false); setAdminWhy(r.label) } }))} />
      <Confirm open={!!adminWhy} title="관리자 권한으로 이 글을 삭제할까요?" message={`사유: ${adminWhy ?? ''} · 삭제하면 되돌릴 수 없어요.`} confirmLabel="삭제" danger
        onClose={() => setAdminWhy(null)}
        onConfirm={async () => {
          const why = adminWhy ?? ''
          setAdminWhy(null)
          try { await api.adminDeletePost(id, why); await qc.invalidateQueries({ queryKey: ['posts'] }); toast('관리자 권한으로 글을 삭제했어요'); nav(-1) } catch (e) { toast(errorText(e)) }
        }} />
      <ReportSheet open={!!report} target={report ?? {}} onClose={() => setReport(null)} />
      <Confirm open={del} title="글을 삭제할까요?" message="삭제하면 되돌릴 수 없어요." confirmLabel="삭제" danger onClose={() => setDel(false)}
        onConfirm={async () => {
          try { await api.deletePost(id); await qc.invalidateQueries({ queryKey: ['posts'] }); toast('글을 삭제했어요'); nav(-1) } catch (e) { toast(errorText(e)) }
        }} />
      {actions.dialog}
    </div>
  )
}

// 원 댓글 → 그 아래 답글(시간순) 순서로 펼친다. 원 댓글이 지워져 짝이 없는 답글은 맨 끝에
function threaded(list: Comment[]) {
  const roots = list.filter((c) => !c.parentId)
  const out: Comment[] = []
  for (const r of roots) out.push(r, ...list.filter((c) => c.parentId === r.id))
  return [...out, ...list.filter((c) => c.parentId && !roots.some((r) => r.id === c.parentId))]
}

// 공연 후기 글: 어떤 공연의 후기인지
function PostConcert({ id }: { id: string }) {
  const c = useConcerts().data?.find((x) => x.id === id)
  if (!c) return null
  return (
    <Link to={`/concert/${c.id}`} className="mt-3 flex items-center gap-2 rounded-[10px] bg-mist px-3 py-2.5 t-sub active:opacity-70">
      <span className="shrink-0 font-semibold">공연 후기</span><span className="truncate text-graphite">{c.title}</span>
    </Link>
  )
}
