import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { PostRow } from '@/components/PostRow'
import { Button } from '@/components/ui/Button'
import { Empty } from '@/components/ui/Empty'
import { keys, useMe } from '@/lib/queries'

// 공연 후기 모아보기: 내가 쓴 글 중 "후기" 태그
export default function Reviews() {
  const nav = useNavigate()
  const me = useMe().data
  const posts = useQuery({
    queryKey: keys.posts({ authorId: me?.id, tag: '후기' }),
    queryFn: () => api.listPosts({ authorId: me!.id, tag: '후기' }),
    enabled: !!me,
  })
  return (
    <>
      <AppHeader back title="공연 후기" />
      {posts.data?.length ? <ul>{posts.data.map((p) => <PostRow key={p.id} post={p} />)}</ul>
        : <Empty title="아직 쓴 후기가 없어요" body="커뮤니티에 글을 쓸 때 '후기' 태그를 달면 여기에 모여요."
            action={<Button size="md" onClick={() => nav('/community/write')}>후기 쓰기</Button>} />}
    </>
  )
}
