import { useRef } from 'react'
import type { Message } from '@/api'
import { IconMore } from '@/components/icons'
import { fmtTime } from '@/lib/date'
import { isVideo } from './MediaViewer'

// 끝의 마침표·괄호 등은 링크에서 뺀다
const URL_RE = /(https?:\/\/[^\s<>"]*[^\s<>".,!?)\]'])/g

// 받은 쪽과 같은 규칙: 말풍선 너비는 줄(row)의 72% 까지. (전에는 % 를 내 메시지를 감싼 버튼 기준으로 재서 내 말풍선만 세로로 길쭉했다)
// 내 메시지 메뉴(onMenu): 휴대폰은 길게 누르기, 웹은 마우스를 올리면 나오는 … 버튼
export function Bubble({ m, mine, onMenu, onOpen, onLink }: {
  m: Message; mine: boolean; onMenu?: () => void; onOpen: (url: string) => void; onLink: (url: string) => void
}) {
  const timer = useRef(0)
  const held = useRef(false)
  if (m.kind === 'system') return <p className="mx-auto my-3 max-w-[80%] text-center t-cap text-graphite">{m.body}</p>

  const stop = () => window.clearTimeout(timer.current)
  const press = onMenu ? {
    onPointerDown: () => { held.current = false; timer.current = window.setTimeout(() => { held.current = true; onMenu() }, 500) },
    onPointerUp: stop, onPointerLeave: stop, onPointerCancel: stop,
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); onMenu() }, // 안드로이드 길게 누르기·웹 우클릭
    // 길게 눌러 메뉴를 연 뒤 손을 떼면서 사진·링크가 열리지 않게
    onClickCapture: (e: React.MouseEvent) => { if (held.current) { e.preventDefault(); e.stopPropagation(); held.current = false } },
  } : {}

  const url = m.imageUrl
  const content = m.deleted
    ? <p className="rounded-[18px] border border-hairline px-3.5 py-2 t-body text-graphite">{m.body}</p>
    : m.kind === 'image' && url
      ? (
        <button type="button" onClick={() => onOpen(url)} aria-label={isVideo(url) ? '영상 크게 보기' : '사진 크게 보기'} className="relative block overflow-hidden rounded-[16px] bg-mist">
          {isVideo(url)
            ? <><video src={url} muted playsInline preload="metadata" draggable={false} className="block max-h-64 max-w-full object-cover" />
              <span aria-hidden className="absolute inset-0 m-auto flex h-11 w-11 items-center justify-center rounded-full bg-black/50 pl-0.5 text-[18px] text-white">▶</span></>
            : <img src={url} alt={m.gifSlug ? 'GIF' : '보낸 사진'} draggable={false} className="block max-h-64 max-w-full object-cover" />}
        </button>
      )
      : (
        <p className={`whitespace-pre-wrap break-words rounded-[18px] px-3.5 py-2 t-body [overflow-wrap:anywhere] ${mine ? 'bg-ink text-paper' : 'bg-mist'}`}>
          {m.body.split(URL_RE).map((part, i) => i % 2
            ? <a key={i} href={part} onClick={(e) => { e.preventDefault(); onLink(part) }} className="underline underline-offset-2">{part}</a>
            : part)}
        </p>
      )

  return (
    <div className={`group flex items-end gap-1.5 ${mine ? 'flex-row-reverse' : ''}`}>
      {/* 정렬·색으로만 구분하던 보낸 사람을 화면낭독기에도 알린다 */}
      <span className="sr-only">{mine ? '내 메시지' : '받은 메시지'}</span>
      <div className="min-w-0 max-w-[72%] [-webkit-touch-callout:none] [@media(hover:none)]:select-none" {...press}>{content}</div>
      {onMenu && (
        <button type="button" onClick={onMenu} aria-label="메시지 메뉴"
          className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-graphite opacity-0 hover:bg-mist focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:hidden">
          <IconMore size={18} />
        </button>
      )}
      <span className={`flex shrink-0 flex-col pb-0.5 text-[11px] text-graphite num ${mine ? 'items-end' : 'items-start'}`}>
        {m.edited && !m.deleted && <span>수정됨</span>}
        {fmtTime(m.createdAt)}
      </span>
    </div>
  )
}
