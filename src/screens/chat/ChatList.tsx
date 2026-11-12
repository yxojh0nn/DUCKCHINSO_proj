import { Link } from 'react-router-dom'
import { AppHeader } from '@/components/AppHeader'
import { IconNoChat } from '@/components/icons'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Empty } from '@/components/ui/Empty'
import { fmtRelative } from '@/lib/date'
import { useRooms } from '@/lib/queries'

// 채팅 목록: 왼쪽 사진·닉네임, 아래 마지막 메시지(새 메시지는 굵게), 오른쪽 안 읽은 수
export default function ChatList() {
  const rooms = useRooms()
  return (
    <>
      <AppHeader large title="채팅" />
      {rooms.data?.length ? (
        <ul className="pb-6">
          {rooms.data.map((r) => {
            const preview = r.lastKind === 'image' ? '사진·영상을 보냈어요' : r.lastBody ?? ''
            return (
              <li key={r.id}>
                <Link to={`/chats/${r.id}`} className="flex items-center gap-3 px-5 py-3 active:bg-mist">
                  {r.kind === 'support'
                    ? <span aria-hidden className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-ink text-[20px] font-extrabold text-paper">덕</span>
                    : <Avatar url={r.partner.avatarUrl} name={r.partner.nickname} size={52} />}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-2">
                      <span className="truncate t-body font-semibold">{r.partner.nickname}</span>
                      <span className="shrink-0 t-cap text-graphite num">{fmtRelative(r.lastAt)}</span>
                    </span>
                    <span className={`mt-0.5 block truncate t-sub ${r.unread ? 'font-bold text-ink' : 'text-graphite'}`}>{preview}</span>
                  </span>
                  <Badge count={r.unread} />
                  {r.unread > 0 && <span className="sr-only">안 읽은 메시지 {r.unread}개</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <Empty icon={<IconNoChat size={56} strokeWidth={1.4} />} title={rooms.isLoading ? '불러오는 중…' : '아직 채팅이 없어요'}
          action={!rooms.isLoading && <Link to="/community?tab=friends" className="t-body font-semibold underline underline-offset-4">추천 덕친 보러 가기</Link>} />
      )}
    </>
  )
}
