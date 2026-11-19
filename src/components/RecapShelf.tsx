import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { trapTab, useDialogFocus } from './ui/a11y'
import { IconLock } from './icons'

const W = 104 // 카드 너비
const H = 172 // 카드 높이
const PEEK = 40 // 한 번 누르면 이만큼 올라온다
const TOP = PEEK + 8 // 카드 위 빈자리: 올라온 카드(튀어 오를 때 넘치는 만큼 포함)가 위 '리캡' 제목에 닿지 않게
const OVERLAP = 26 // 옆 카드와 겹치는 너비 (오른쪽 카드가 왼쪽 카드의 오른쪽 끝을 덮는다)
const FRONT = 40 // 서랍 앞판 높이 (카드 아랫부분을 가림)
const VISIBLE = 50 // 서랍 위로 보이는 카드 윗부분: 카드 높이의 약 30% (연·월 두 줄만), 프로필 공간을 넉넉히
const MS = 480

type Rect = { left: number; top: number; width: number; height: number }
// from: 올라온 자리(뽑기 시작), rest: 서랍에 꽂힌 자리(넣기 끝), line: 서랍 앞판 윗선(화면 기준)
type Open = { p: string; from: Rect; rest: Rect; line: number; go: boolean; closing: boolean }

// 리캡 서랍: 카드가 가로로 겹쳐 꽂혀 윗부분(연·월)만 보인다. 왼쪽이 오래된 카드, 오른쪽이 최근 (처음엔 오른쪽 끝을 보여 준다)
//   한 번 누르면 그 카드가 살짝 튀어 올라오고(1차, 다른 곳을 누르면 다시 내려간다),
//   올라온 카드를 한 번 더 누르면 서랍에서 부드럽게 뽑혀 나와 화면 가운데로 커지며 리캡이 서서히 드러난다(2차, 다른 화면으로 넘어가지 않음)
export function RecapShelf({ periods, count, renderCard, actions, warm }: {
  periods: string[]; count: (period: string) => number
  warm?: (period: string) => void // 1차(살짝 올라옴) 때 미리 그려 둔다 → 2차에 바로 보이게
  renderCard: (period: string) => React.ReactNode // 2차에 커진 카드에 보여 줄 리캡
  actions?: (period: string) => React.ReactNode // 커진 카드 아래 버튼 (본인: 저장·공유 등)
}) {
  const [peek, setPeek] = useState<string | null>(null)
  const [open, setOpen] = useState<Open | null>(null)
  const row = useRef<HTMLDivElement>(null)
  const drawer = useRef<HTMLDivElement>(null)
  useEffect(() => { row.current?.scrollTo({ left: row.current.scrollWidth }) }, [periods.length])

  // 올라온 카드는 다른 곳을 한 번 누르면 다시 내려간다
  useEffect(() => {
    if (!peek || open) return
    const down = (e: PointerEvent) => { if (!(e.target as Element).closest?.('[data-recap-card]')) setPeek(null) }
    document.addEventListener('pointerdown', down, true)
    return () => document.removeEventListener('pointerdown', down, true)
  }, [peek, open])

  const press = (p: string, el: HTMLElement) => {
    if (open) return
    if (peek !== p) { warm?.(p); return setPeek(p) }
    const r = el.getBoundingClientRect()
    const from = { left: r.left, top: r.top, width: r.width, height: r.height }
    setOpen({ p, from, rest: { ...from, top: from.top + PEEK }, line: drawer.current!.getBoundingClientRect().top, go: false, closing: false })
    requestAnimationFrame(() => requestAnimationFrame(() => setOpen((o) => o && { ...o, go: true }))) // 제자리에서 그린 다음 커진다
  }
  // 닫기: 커진 카드가 작아지며 올라온 자리에 멈추지 않고 한 번에 서랍 속 자리로 미끄러져 들어간다
  const close = () => {
    setPeek(null) // 서랍 속 카드(투명)도 같이 내려가 있게
    setOpen((o) => o && { ...o, go: false, closing: true })
    window.setTimeout(() => setOpen(null), MS)
  }

  if (!periods.length) return null
  return (
    // 카드 전체가 들어가는 줄을 바깥 상자가 아래쪽만 잘라 보여 준다
    // overflow-clip: hidden 과 달리 스크롤되지 않아서, 누른 카드에 초점이 가도 상자가 세로로 밀려 카드 윗부분이 잘리거나 서랍 아래로 삐져나오지 않는다
    <div className="pointer-events-none relative mx-3 overflow-clip" style={{ height: TOP + VISIBLE + FRONT }}>
      <div ref={row} role="list" aria-label="리캡 서랍" className="flex overflow-x-auto overflow-y-hidden px-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ paddingTop: TOP, height: TOP + H }}>
        {periods.map((p, i) => {
          const up = peek === p
          const n = count(p)
          return (
            // 올라온 카드는 겹친 이웃보다 앞으로
            <div key={p} role="listitem" className="pointer-events-auto relative shrink-0" style={{ marginLeft: i ? -OVERLAP : 0, zIndex: up ? periods.length : i }}>
              <button type="button" data-recap-card onClick={(e) => press(p, e.currentTarget)} aria-expanded={up}
                aria-label={`${titleOf(p)} 리캡, 공연 ${n}개. ${up ? '한 번 더 누르면 크게 보기' : '누르면 꺼내 보기'}`}
                className="flex flex-col justify-start rounded-[14px] border border-hairline bg-mist text-left text-ink shadow-[-4px_0_10px_rgba(0,0,0,0.08)] motion-reduce:transition-none"
                style={{
                  width: W, height: H,
                  transform: up ? `translateY(-${PEEK}px)` : 'none',
                  opacity: open?.p === p ? 0 : 1, // 뽑혀 나간 동안은 커진 카드가 대신 보인다
                  transition: 'transform 280ms cubic-bezier(.3,1.5,.5,1)', // 살짝 튀어 오름 (끝에서 조금 넘쳤다 돌아옴)
                }}>
                <Face p={p} n={n} showCount={up} />
              </button>
            </div>
          )
        })}
        <span aria-hidden className="w-3 shrink-0" />
      </div>
      <Drawer ref={drawer} z={periods.length + 1} />
      {open && <Opened open={open} n={count(open.p)} onClose={close} actions={actions?.(open.p)}>{renderCard(open.p)}</Opened>}
    </div>
  )
}

// 잠긴 서랍: 멤버십이 없으면 빈 서랍을 어둡게 덮고 자물쇠와 안내를 얹는다 (카드는 눌리지 않는 모양만)
export function LockedShelf({ periods, message, action }: { periods: string[]; message: string; action?: React.ReactNode }) {
  return (
    <div className="relative mx-3 overflow-clip rounded-[14px]" style={{ height: TOP + VISIBLE + FRONT }}>
      <div aria-hidden className="flex px-3" style={{ paddingTop: TOP }}>
        {periods.map((p, i) => (
          <span key={p} className="relative shrink-0 rounded-[14px] border border-hairline bg-mist text-ink shadow-[-4px_0_10px_rgba(0,0,0,0.08)]"
            style={{ width: W, height: H, marginLeft: i ? -OVERLAP : 0, zIndex: i }}>
            <Face p={p} n={0} showCount={false} />
          </span>
        ))}
      </div>
      <Drawer z={periods.length + 1} />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-black/65 px-6 backdrop-blur-[3px] text-center text-white" style={{ zIndex: periods.length + 2 }}>
        <IconLock size={22} />
        <p className="t-sub font-semibold">{message}</p>
        {action}
      </div>
    </div>
  )
}

// 서랍 앞판: 앱 바탕색 + 위 가는 선 + 가운데 손잡이 막대(흑백 테마에 맞춤). 카드 아랫부분을 가리고, 앞판을 눌러도 뒤 카드가 눌리지 않는다
export function Drawer({ z, ref }: { z: number; ref?: React.Ref<HTMLDivElement> }) {
  return (
    <div ref={ref} aria-hidden className="pointer-events-auto absolute inset-x-0 bottom-0 rounded-t-[10px] border-t border-hairline bg-paper shadow-[0_-6px_12px_rgba(0,0,0,0.06)]"
      style={{ height: FRONT, zIndex: z }}>
      <span className="absolute left-1/2 top-1/2 h-[4px] w-[36px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-hairline" />
    </div>
  )
}

const titleOf = (p: string) => (p.length === 7 ? `${p.slice(0, 4)}년 ${Number(p.slice(5))}월` : `${p}년 돌아보기`)

function Face({ p, n, showCount }: { p: string; n: number; showCount: boolean }) {
  const monthly = p.length === 7
  return (
    <span className="block px-3 pt-2.5">
      <span className="block text-[11px] font-bold leading-[13px] opacity-70">{monthly ? `${p.slice(0, 4)}년` : '돌아보기'}</span>
      <span className="block text-[24px] font-black leading-[28px] tracking-[-0.03em]">{monthly ? `${Number(p.slice(5))}월` : `${p.slice(2)}’`}</span>
      <span className={`mt-1 block text-[12px] font-semibold transition-opacity ${showCount ? 'opacity-70' : 'opacity-0'}`}>공연 {n}개</span>
    </span>
  )
}

// 2차: 서랍에서 뽑힌 카드가 한 번의 부드러운 곡선으로 화면 가운데까지 커진다. 커지는 동안 표지(연·월) 위로 리캡이 서서히 겹쳐 드러나고,
//   닫으면 리캡이 먼저 옅어지며 같은 곡선으로 작아져 서랍에 들어간다. 바깥을 누르거나 닫기로 돌아간다
// 서랍 앞판 윗선 아래는 잘라 그려서, 뽑힐 때는 서랍 속에서 올라오고 넣을 때는 앞판 뒤로 들어가는 것처럼 보인다
function Opened({ open, n, onClose, actions, children }: {
  open: Open; n: number; onClose: () => void; actions?: React.ReactNode; children: React.ReactNode
}) {
  const closeBtn = useRef<HTMLButtonElement>(null)
  useDialogFocus(true, onClose, closeBtn)
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  const room = 120 // 카드 아래 버튼 자리
  const h = Math.min(window.innerHeight - room - 48, (Math.min(360, window.innerWidth * 0.86)) * 16 / 9)
  const w = h * 9 / 16
  const to = { left: (window.innerWidth - w) / 2, top: Math.max(24, (window.innerHeight - h - room) / 2), width: w, height: h }
  const go = open.go || reduce
  const box = go ? to : open.closing ? open.rest : open.from
  const curve = `${MS}ms cubic-bezier(.32,.72,0,1)` // 빠르게 출발해 끝에서 길게 감속 (튀지 않음)
  const none = reduce ? 'none' : undefined
  const clip = go ? 'inset(0)' : `inset(0 0 ${Math.max(0, window.innerHeight - open.line)}px 0)`
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`${titleOf(open.p)} 리캡`} onClick={onClose} onKeyDown={trapTab}
      className="fixed inset-0 z-50" style={{ background: go ? 'rgba(0,0,0,0.55)' : 'rgba(0,0,0,0)', transition: none ?? `background ${MS}ms ease-out` }}>
      <div className="pointer-events-none fixed inset-0" style={{ clipPath: clip, transition: none ?? `clip-path ${curve}` }}>
        <div onClick={(e) => e.stopPropagation()} className="pointer-events-auto absolute overflow-hidden border border-hairline bg-mist text-ink"
          style={{ ...box, borderRadius: go ? 20 : 14,
            boxShadow: go ? '0 24px 60px rgba(0,0,0,0.32)' : '0 4px 12px rgba(0,0,0,0.10)', // 들어 올릴수록 그림자가 깊어진다
            transition: none ?? `left ${curve}, top ${curve}, width ${curve}, height ${curve}, border-radius ${curve}, box-shadow ${curve}` }}>
          {/* 표지(연·월) 위에 리캡을 겹쳐 서서히. 열 때는 조금 커진 뒤 드러나고, 닫을 때는 먼저 빠르게 옅어진다 */}
          <Face p={open.p} n={n} showCount={!open.closing} />
          <div className="absolute inset-0" style={{ opacity: go ? 1 : 0, transition: none ?? (go ? 'opacity 300ms ease-out 140ms' : 'opacity 160ms ease-in') }}>{children}</div>
        </div>
      </div>
      <div onClick={(e) => e.stopPropagation()} className="absolute inset-x-0 flex flex-col items-center gap-2 px-8"
        style={{ top: to.top + h + 16, opacity: go ? 1 : 0, pointerEvents: go ? 'auto' : 'none', transition: none ?? (go ? 'opacity 220ms ease-out 220ms' : 'opacity 120ms ease-in') }}>
        {actions}
        <button ref={closeBtn} type="button" onClick={onClose} className="h-11 px-4 t-body font-semibold text-white">닫기</button>
      </div>
    </div>,
    document.body,
  )
}
