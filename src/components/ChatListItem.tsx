import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ChatRoom } from '@/store/useAppStore'
import { fmtTime } from '@/lib/date'

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
    <div className="relative overflow-hidden border-b border-line bg-chip select-none">
      <button onClick={onHide} className="absolute inset-y-0 right-0 bg-ink text-sm font-semibold text-surface" style={{ width: REVEAL }}>
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
        className="relative flex items-center gap-3 bg-surface px-4 py-3 transition-transform touch-pan-y"
        style={{ transform: `translateX(${dx}px)`, transitionDuration: start.current ? '0ms' : '150ms' }}
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-user-soft font-bold text-user">{nickname[0]}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-sm font-bold">{nickname}</p>
            {last && <span className="shrink-0 text-[11px] text-muted">{fmtTime(last.at)}</span>}
          </div>
          <p className={`truncate text-xs ${room.partnerLeftAt ? 'text-crit' : 'text-muted'}`}>{preview}</p>
        </div>
      </Link>
    </div>
  )
}
