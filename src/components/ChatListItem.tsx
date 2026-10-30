import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ChatRoom } from '@/store/useAppStore'
import { fmtTime } from '@/lib/date'
import { Avatar } from './MatchCard'

type Props = { room: ChatRoom; nickname: string; onHide: () => void; onLongPress: () => void }

const REVEAL = 80 // 숨기기 버튼 너비(px)

// 왼쪽으로 밀면 숨기기 버튼, 길게 누르면 메뉴 (기획서 5.4)
export function ChatListItem({ room, nickname, onHide, onLongPress }: Props) {
  const [dx, setDx] = useState(0)
  const start = useRef<{ x: number; y: number; base: number } | null>(null)
  const moved = useRef(false)
  const timer = useRef<number | undefined>(undefined)

  const last = room.messages[room.messages.length - 1]
  const preview = room.partnerLeftAt ? '상대방이 대화방을 나갔습니다' : last?.text ?? ''

  const onDown = (e: React.PointerEvent) => {
    start.current = { x: e.clientX, y: e.clientY, base: dx }
    moved.current = false
    timer.current = window.setTimeout(() => {
      if (!moved.current) { moved.current = true; onLongPress() }
    }, 550)
  }
  const onMove = (e: React.PointerEvent) => {
    if (!start.current) return
    const ddx = e.clientX - start.current.x
    if (Math.abs(ddx) > 6 || Math.abs(e.clientY - start.current.y) > 6) {
      moved.current = true
      clearTimeout(timer.current)
    }
    setDx(Math.max(-REVEAL, Math.min(0, start.current.base + ddx)))
  }
  const onUp = () => {
    clearTimeout(timer.current)
    if (start.current) setDx((v) => (v < -REVEAL / 2 ? -REVEAL : 0))
    start.current = null
  }

  return (
    <li className="group relative overflow-hidden bg-graphite select-none">
      <button onClick={onHide} className="absolute inset-y-0 right-0 t-sub font-semibold text-paper" style={{ width: REVEAL }}>
        숨기기
      </button>
      <Link
        to={`/chats/${room.id}`}
        draggable={false}
        onClick={(e) => { if (moved.current || dx !== 0) { e.preventDefault(); if (!moved.current) setDx(0) } }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onContextMenu={(e) => e.preventDefault()}
        className="relative flex items-center gap-3 bg-paper px-5 py-2.5 transition-transform touch-pan-y active:bg-mist"
        style={{ transform: `translateX(${dx}px)`, transitionDuration: start.current ? '0ms' : '150ms' }}
      >
        <Avatar name={nickname} size={50} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate t-head">{nickname}</p>
            {last && <span className="shrink-0 t-sub text-graphite num">{fmtTime(last.at)}</span>}
          </div>
          <p className={`line-clamp-2 t-sub ${room.partnerLeftAt ? 'text-danger' : 'text-graphite'}`}>{preview}</p>
        </div>
      </Link>
      <span aria-hidden className="pointer-events-none absolute bottom-0 left-[82px] right-0 h-px bg-hairline/70 group-last:hidden" />
    </li>
  )
}
