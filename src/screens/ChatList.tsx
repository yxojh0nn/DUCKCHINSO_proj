import { useState } from 'react'
import { MOCK_USERS } from '@/data/mock'
import { useAppStore } from '@/store/useAppStore'
import { AppHeader } from '@/components/AppHeader'
import { ChatListItem } from '@/components/ChatListItem'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'

// 채팅 목록: 밀어서 숨기기, 길게 눌러 메뉴 (기획서 5.4)
export default function ChatList() {
  const rooms = useAppStore((s) => s.rooms)
  const hideRoom = useAppStore((s) => s.hideRoom)
  const leaveRoom = useAppStore((s) => s.leaveRoom)
  const [menu, setMenu] = useState<string | null>(null)

  const visible = rooms
    .filter((r) => !r.hiddenAt)
    .sort((a, b) => (b.messages.at(-1)?.at ?? b.createdAt) - (a.messages.at(-1)?.at ?? a.createdAt))
  const hiddenCount = rooms.length - visible.length
  const nick = (id: string) => MOCK_USERS.find((u) => u.id === id)?.nickname ?? '알 수 없음'

  return (
    <>
      <AppHeader title="채팅" />
      <div className="flex-1">
        {visible.map((r) => (
          <ChatListItem key={r.id} room={r} nickname={nick(r.partnerId)} onHide={() => hideRoom(r.id)} onLongPress={() => setMenu(r.id)} />
        ))}
        {visible.length === 0 && (
          <p className="px-6 py-16 text-center text-sm text-muted">아직 대화가 없어요.<br />매칭에서 취향이 겹치는 사람에게 대화를 요청해 보세요.</p>
        )}
        <p className="px-4 py-3 text-[11px] text-muted">
          왼쪽으로 밀거나 길게 누르면 목록에서 숨길 수 있어요. 숨겨도 상대에게는 알리지 않고, 새 메시지가 오면 다시 보여요.
          {hiddenCount > 0 && ` (숨긴 대화 ${hiddenCount}개)`}
        </p>
      </div>

      <Sheet open={!!menu} onClose={() => setMenu(null)} title="대화방 관리">
        <div className="flex flex-col gap-2">
          <Button variant="secondary" block onClick={() => { hideRoom(menu!); setMenu(null) }}>목록에서 숨기기</Button>
          <Button variant="danger" block onClick={() => { leaveRoom(menu!); setMenu(null) }}>대화방 나가기</Button>
          <Button variant="ghost" block onClick={() => setMenu(null)}>취소</Button>
        </div>
      </Sheet>
    </>
  )
}
