import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MOCK_USERS } from '@/data/mock'
import { useAppStore } from '@/store/useAppStore'
import { AppHeader } from '@/components/AppHeader'
import { MessageBubble } from '@/components/MessageBubble'
import { Sheet } from '@/components/ui/Sheet'

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

  if (!room) return <><AppHeader title="채팅" back /><p className="px-5 py-10 t-body text-graphite">대화방이 없어요.</p></>

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
          <button aria-label="대화방 메뉴" onClick={() => setSheet('menu')} className="flex h-11 w-11 items-center justify-center text-ink active:opacity-50">
            <svg aria-hidden viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="currentColor"><circle cx="5" cy="12" r="1.7" /><circle cx="12" cy="12" r="1.7" /><circle cx="19" cy="12" r="1.7" /></svg>
          </button>
        }
      />
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {room.messages.map((m) => <MessageBubble key={m.id} m={m} />)}
        {left && <p className="my-5 text-center t-sub font-medium text-graphite">상대방이 대화방을 나갔습니다</p>}
        <div ref={endRef} />
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); submit() }}
        className="flex items-center gap-2 border-t border-hairline/60 bg-paper/90 px-3 py-2 backdrop-blur-xl"
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={left}
          aria-label="메시지"
          placeholder={left ? '상대방이 나가서 메시지를 보낼 수 없어요' : '메시지'}
          className="h-9 min-w-0 flex-1 rounded-full border border-hairline px-4 t-body outline-none focus:border-graphite disabled:bg-mist disabled:text-graphite"
        />
        <button
          type="submit"
          aria-label="보내기"
          disabled={left || !text.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-paper transition-opacity disabled:bg-hairline"
        >
          <svg aria-hidden viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 13V3M3.5 7.5L8 3l4.5 4.5" /></svg>
        </button>
      </form>

      <Sheet
        open={sheet === 'menu'}
        onClose={() => setSheet(null)}
        actions={[
          { label: '신고하기', onClick: () => setSheet('report') },
          { label: '차단하기', destructive: true, onClick: () => setSheet('block') },
          { label: '대화방 나가기', destructive: true, onClick: () => setSheet('leave') },
        ]}
      />
      <Sheet
        open={sheet === 'report'}
        onClose={() => setSheet(null)}
        title="신고 사유"
        actions={REPORT_REASONS.map((r) => ({
          label: r,
          onClick: () => { report(room.partnerId, r); setSheet(null); showToast('신고를 접수했어요') },
        }))}
      />
      <Sheet
        open={sheet === 'block'}
        onClose={() => setSheet(null)}
        title={`${nick} 님을 차단할까요?`}
        message="대화방이 내 목록에서 사라지고 서로 추천되지 않아요. 상대에게는 알리지 않아요. 내 정보에서 언제든 해제할 수 있어요."
        actions={[{ label: '차단하기', destructive: true, onClick: () => { block(room.partnerId); showToast('차단했어요'); nav('/chats', { replace: true }) } }]}
      />
      <Sheet
        open={sheet === 'leave'}
        onClose={() => setSheet(null)}
        title="대화방을 나갈까요?"
        message={'대화 내용이 내 목록에서 사라지고, 상대에게는 "상대방이 대화방을 나갔습니다"가 표시돼요.'}
        actions={[{ label: '나가기', destructive: true, onClick: () => { leaveRoom(room.id); nav('/chats', { replace: true }) } }]}
      />
    </div>
  )
}
