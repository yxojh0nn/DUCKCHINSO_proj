import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, type UserCard } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { UserRow } from '@/components/UserRow'
import { IconFriends } from '@/components/icons'
import { Button } from '@/components/ui/Button'
import { Confirm } from '@/components/ui/Confirm'
import { Empty } from '@/components/ui/Empty'
import { useFriendActions } from '@/lib/actions'
import { keys } from '@/lib/queries'

// 친구 관리: 친구 목록(삭제·차단), 차단 목록(해제). 요청 수락·거절은 커뮤니티 탭에서
export default function Friends() {
  const friends = useQuery({ queryKey: keys.friends, queryFn: () => api.listFriends() })
  const blocked = useQuery({ queryKey: keys.blocked, queryFn: () => api.listBlocked() })
  const actions = useFriendActions()
  const [confirm, setConfirm] = useState<{ kind: 'remove' | 'block'; user: UserCard } | null>(null)

  return (
    <>
      <AppHeader back title="친구 관리" />
      {friends.data?.length ? (
        <ul className="pt-1">
          {friends.data.map((f) => (
            <UserRow key={f.id} user={f} right={<>
              <Button size="sm" variant="secondary" onClick={() => setConfirm({ kind: 'remove', user: f })}>삭제</Button>
              <Button size="sm" variant="danger" onClick={() => setConfirm({ kind: 'block', user: f })}>차단</Button>
            </>} />
          ))}
        </ul>
      ) : <Empty icon={<IconFriends size={44} />} title={friends.isLoading ? '불러오는 중…' : '아직 친구가 없어요'} />}

      {!!blocked.data?.length && (
        <section className="mt-6">
          <h2 className="px-5 pb-1 t-sub font-semibold text-graphite">차단한 사람</h2>
          <ul>
            {blocked.data.map((u) => (
              <UserRow key={u.id} user={u} right={<Button size="sm" variant="secondary" onClick={() => actions.unblock(u.id)}>해제</Button>} />
            ))}
          </ul>
        </section>
      )}

      <Confirm open={!!confirm} danger
        title={confirm ? `${confirm.user.nickname} 님을 ${confirm.kind === 'remove' ? '친구에서 삭제' : '차단'}할까요?` : ''}
        message={confirm?.kind === 'remove' ? '대화 기록은 남지만 더 이상 메시지를 보낼 수 없어요.' : '서로의 글·추천·요청·채팅이 보이지 않게 돼요.'}
        confirmLabel={confirm?.kind === 'remove' ? '삭제' : '차단'} onClose={() => setConfirm(null)}
        onConfirm={() => {
          if (!confirm) return
          ;(confirm.kind === 'remove' ? actions.remove : actions.block)(confirm.user.id)
          setConfirm(null)
        }} />
    </>
  )
}
