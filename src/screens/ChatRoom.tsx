import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MOCK_USERS } from '@/data/mock'
import { useAppStore } from '@/store/useAppStore'
import { AppHeader } from '@/components/AppHeader'
import { MessageBubble } from '@/components/MessageBubble'
import { Sheet } from '@/components/ui/Sheet'
import { Button } from '@/components/ui/Button'

const REPORT_REASONS = ['티켓 사기·암표 거래', '욕설·괴롭힘', '성적 불쾌감', '스팸·광고', '기타']

// 1:1 채팅방 (기획서 5.4). 상대가 나가면 안내 문구를 띄우고 입력을 막는다
export default function ChatRoom() {
  const { id } = useParams()
  const nav = useNavigate()
  const room = useAppStore((s) => s.rooms.find((r) => r.id === id))
  const { sendMessage, leaveRoom, block, report, showToast } = useAppStore()
  const [text, setText] = useState('')
  const [sheet, setSheet] = useState<null | 'menu' | 'report' | 'block' | 'leave'>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [room?.messages.length])

  if (!room) return <><AppHeader title="채팅" back /><p className="p-8 text-center text-sm text-muted">대화방이 없어요</p></>

  const nick = MOCK_USERS.find((u) => u.id === room.partnerId)?.nickname ?? '알 수 없음'
  const left = !!room.partnerLeftAt
  const submit = () => {
    const t = text.trim()
    if (!t) return
    sendMessage(room.id, t)
    setText('')
  }

  return (
    <div className="flex h-full flex-col">
      <AppHeader
        title={nick}
        back
        right={
          <button aria-label="메뉴" onClick={() => setSheet('menu')} className="rounded-lg p-1.5 text-muted hover:bg-chip">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" /></svg>
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto bg-bg px-3 py-3">
        {room.messages.map((m) => <MessageBubble key={m.id} m={m} />)}
        {left && <p className="mx-auto my-3 w-fit rounded-full bg-crit/10 px-3 py-1.5 text-xs font-semibold text-crit">상대방이 대화방을 나갔습니다</p>}
        <div ref={endRef} />
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); submit() }}
        className="flex gap-2 border-t border-line bg-surface p-2.5"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={left}
          placeholder={left ? '상대방이 나가서 메시지를 보낼 수 없어요' : '메시지 입력'}
          className="min-w-0 flex-1 rounded-xl bg-chip px-3 py-2 text-sm outline-none disabled:opacity-60"
        />
        <Button type="submit" disabled={left || !text.trim()} className="!px-3">전송</Button>
      </form>

      <Sheet open={sheet === 'menu'} onClose={() => setSheet(null)} title="대화방 메뉴">
        <div className="flex flex-col gap-2">
          <Button variant="secondary" block onClick={() => setSheet('report')}>신고하기</Button>
          <Button variant="secondary" block onClick={() => setSheet('block')}>차단하기</Button>
          <Button variant="danger" block onClick={() => setSheet('leave')}>대화방 나가기</Button>
        </div>
      </Sheet>
      <Sheet open={sheet === 'report'} onClose={() => setSheet(null)} title="신고 사유를 골라 주세요">
        <div className="flex flex-col gap-2">
          {REPORT_REASONS.map((r) => (
            <Button key={r} variant="secondary" block onClick={() => { report(room.partnerId, r); setSheet(null); showToast('신고가 접수됐어요. 운영자가 확인할게요') }}>{r}</Button>
          ))}
        </div>
      </Sheet>
      <Sheet open={sheet === 'block'} onClose={() => setSheet(null)} title={`${nick} 님을 차단할까요?`}>
        <p className="mb-4 text-sm text-muted">차단하면 이 대화방이 내 목록에서 사라지고 서로 추천되지 않아요. 상대에게는 차단 사실을 알리지 않아요. 해제는 내 정보 › 차단 목록에서 할 수 있어요.</p>
        <Button variant="danger" block onClick={() => { block(room.partnerId); showToast('차단했어요'); nav('/chats', { replace: true }) }}>차단하기</Button>
      </Sheet>
      <Sheet open={sheet === 'leave'} onClose={() => setSheet(null)} title="대화방을 나갈까요?">
        <p className="mb-4 text-sm text-muted">나가면 대화 내용이 내 목록에서 사라지고, 상대에게는 "상대방이 대화방을 나갔습니다"가 표시돼요.</p>
        <Button variant="danger" block onClick={() => { leaveRoom(room.id); nav('/chats', { replace: true }) }}>나가기</Button>
      </Sheet>
    </div>
  )
}
