import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { PostRow } from '@/components/PostRow'
import { Button } from '@/components/ui/Button'
import { Empty } from '@/components/ui/Empty'
import { keys, useMe } from '@/lib/queries'

// 내가 남긴 공연 후기: 지난 공연에서 남긴 후기 + '후기' 태그를 단 글
export default function Reviews() {
  const nav = useNavigate()
  const me = useMe().data
  const posts = useQuery({
    queryKey: keys.posts({ authorId: me?.id, reviews: true }),
    queryFn: () => api.listPosts({ authorId: me!.id, reviews: true }),
    enabled: !!me,
  })
  return (
    <>
      <AppHeader back title="내 공연 후기" />
      {posts.data?.length ? <ul>{posts.data.map((p) => <PostRow key={p.id} post={p} />)}</ul>
        : <Empty title="아직 쓴 후기가 없어요" body="커뮤니티 > 후기 남기기에서 다녀온 공연을 골라 후기를 남겨 보세요."
            action={<Button size="md" onClick={() => nav('/community?tab=reviews')}>후기 남기기</Button>} />}
    </>
  )
}
