import { AppHeader } from '@/components/AppHeader'
import { UserRow } from '@/components/UserRow'
import { IconRequests } from '@/components/icons'
import { Button } from '@/components/ui/Button'
import { Empty } from '@/components/ui/Empty'
import { useFriendActions } from '@/lib/actions'
import { useRequests } from '@/lib/queries'

const left = (iso: string) => {
  const h = Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 3_600_000))
  return h >= 24 ? `${Math.floor(h / 24)}일 남음` : `${h}시간 남음`
}

// 대기 중인 친구 요청: 받은 요청(수락·거절) / 보낸 요청(응답 대기)
export default function Requests() {
  const requests = useRequests()
  const actions = useFriendActions()
  const incoming = requests.data?.filter((r) => r.direction === 'in') ?? []
  const outgoing = requests.data?.filter((r) => r.direction === 'out') ?? []
  return (
    <>
      <AppHeader back title="친구 요청" />
      {!requests.isLoading && !incoming.length && !outgoing.length && (
        <Empty icon={<IconRequests size={44} />} title="대기 중인 요청이 없어요" />
      )}
      {incoming.length > 0 && (
        <section className="pt-2">
          <h2 className="px-5 pb-1 t-sub font-semibold text-graphite">받은 요청</h2>
          <ul>
            {incoming.map((r) => (
              <UserRow key={r.id} user={r.user} right={<>
                <Button size="sm" variant="secondary" onClick={() => actions.decline(r.id)}>거절</Button>
                <Button size="sm" onClick={() => actions.accept(r.id)}>수락</Button>
              </>} />
            ))}
          </ul>
        </section>
      )}
      {outgoing.length > 0 && (
        <section className="pt-6">
          <h2 className="px-5 pb-1 t-sub font-semibold text-graphite">보낸 요청</h2>
          <ul>{outgoing.map((r) => <UserRow key={r.id} user={r.user} right={<span className="t-sub text-graphite">{left(r.expiresAt)}</span>} />)}</ul>
        </section>
      )}
    </>
  )
}
