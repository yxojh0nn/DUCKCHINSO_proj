import { Link } from 'react-router-dom'
import type { Post } from '@/api'
import { fmtRelative } from '@/lib/date'
import { useIsAdmin } from '@/lib/queries'
import { IconComment, IconUp } from './icons'
import { UserBadge } from './MemberBadge'

// 커뮤니티 글 한 줄: 제목, 본문 두 줄, 태그, 작성자·시각·추천·댓글 수, 오른쪽에 첫 사진
export function PostRow({ post }: { post: Post }) {
  const admin = useIsAdmin(post.author.id)
  return (
    <li className="border-b border-hairline last:border-0">
      <Link to={`/community/post/${post.id}`} className="flex gap-3 px-5 py-4 active:bg-mist">
        <div className="min-w-0 flex-1">
          <p className="truncate t-body font-semibold">{post.title}</p>
          <p className="mt-0.5 line-clamp-2 t-sub text-graphite">{post.body}</p>
          {post.tags.length > 0 && <p className="mt-1.5 truncate t-sub text-ink/80">{post.tags.map((t) => `#${t}`).join(' ')}</p>}
          <p className="mt-1.5 flex items-center gap-2.5 t-cap text-graphite num">
            <span className="flex min-w-0 items-center gap-1"><span className="truncate">{post.author.nickname}</span><UserBadge userId={post.author.id} /></span>
            {admin && <span className="-ml-1.5 shrink-0 font-semibold text-success">관리자</span>}
            <span>{fmtRelative(post.createdAt)}</span>
            <span className="flex items-center gap-0.5"><IconUp size={13} />{post.likeCount}<span className="sr-only">추천</span></span>
            <span className="flex items-center gap-0.5"><IconComment size={13} />{post.commentCount}<span className="sr-only">댓글</span></span>
          </p>
        </div>
        {post.imageUrls[0] && <img src={post.imageUrls[0]} alt="" loading="lazy" className="h-[68px] w-[68px] shrink-0 rounded-[10px] bg-mist object-cover" />}
      </Link>
    </li>
  )
}
