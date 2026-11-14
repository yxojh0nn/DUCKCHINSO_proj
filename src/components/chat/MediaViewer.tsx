import { useEffect, useRef, useState } from 'react'
import { trapTab, useDialogFocus } from '@/components/ui/a11y'
import { IconClose, IconDownload } from '@/components/icons'
import { isKlipyUrl } from '@/lib/klipy'
import { saveMedia } from '@/lib/saveMedia'
import { toast } from '@/store/ui'

// 사진·영상 메시지 공용
export const isVideo = (url: string) => /^data:video|\.(mp4|webm|mov)(\?|$)/i.test(url)

type View = { s: number; x: number; y: number }
const MAX_ZOOM = 2
// 배율은 원본(화면에 맞춘 크기) 1 ~ 2배. 이동은 사진 가장자리가 원래 자리 안쪽으로 들어오지 않을 만큼만
const clampView = (s: number, x: number, y: number, w: number, h: number): View => {
  s = Math.min(MAX_ZOOM, Math.max(1, s))
  const mx = (w * (s - 1)) / 2, my = (h * (s - 1)) / 2
  return { s, x: Math.min(mx, Math.max(-mx, x)), y: Math.min(my, Math.max(-my, y)) }
}
// (px, py) 지점(가운데 기준)을 붙잡은 채로 배율 s 로
const zoomAt = (v: View, s: number, px: number, py: number, w: number, h: number) => {
  const k = Math.min(MAX_ZOOM, Math.max(1, s)) / v.s
  return clampView(v.s * k, px - (px - v.x) * k, py - (py - v.y) * k, w, h)
}

// 사진·영상 크게 보기. 사진 확대: 웹은 휠(최대 200%, 반대로 굴리면 원본까지)·더블클릭 150%, 휴대폰은 두 손가락. 확대 중엔 끌어서 이동
export function Viewer({ url, onClose }: { url: string; onClose: () => void }) {
  const [v, setV] = useState<View>({ s: 1, x: 0, y: 0 })
  const box = useRef<HTMLDivElement>(null)
  const img = useRef<HTMLImageElement>(null)
  const pts = useRef(new Map<number, { x: number; y: number }>())
  useDialogFocus(true, onClose)

  // 가운데 기준 좌표와 사진의 (확대 전) 크기
  const geo = (cx: number, cy: number) => {
    const r = box.current!.getBoundingClientRect()
    return { px: cx - r.left - r.width / 2, py: cy - r.top - r.height / 2, w: img.current?.offsetWidth ?? 0, h: img.current?.offsetHeight ?? 0 }
  }

  useEffect(() => {
    const el = box.current
    if (!el || isVideo(url)) return
    // React 의 onWheel 은 passive 라 기본 스크롤을 막을 수 없어 직접 단다
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const { px, py, w, h } = geo(e.clientX, e.clientY)
      setV((v) => zoomAt(v, v.s * Math.exp(-e.deltaY * 0.002), px, py, w, h))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [url])

  const onDown = (e: React.PointerEvent) => {
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    const prev = pts.current.get(e.pointerId)
    if (!prev) return
    const before = [...pts.current.values()]
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const after = [...pts.current.values()]
    if (after.length >= 2) {
      // 두 손가락: 손가락 사이 거리 비율만큼 배율, 가운데 점 이동만큼 이동
      const [a0, b0] = before, [a1, b1] = after
      const d0 = Math.hypot(a0.x - b0.x, a0.y - b0.y), d1 = Math.hypot(a1.x - b1.x, a1.y - b1.y)
      const m = geo((a1.x + b1.x) / 2, (a1.y + b1.y) / 2)
      const dx = (a1.x + b1.x - a0.x - b0.x) / 2, dy = (a1.y + b1.y - a0.y - b0.y) / 2
      setV((v) => {
        const z = zoomAt(v, d0 ? (v.s * d1) / d0 : v.s, m.px, m.py, m.w, m.h)
        return clampView(z.s, z.x + dx, z.y + dy, m.w, m.h)
      })
    } else {
      const { w, h } = geo(0, 0)
      setV((v) => (v.s > 1 ? clampView(v.s, v.x + e.clientX - prev.x, v.y + e.clientY - prev.y, w, h) : v))
    }
  }
  const onUp = (e: React.PointerEvent) => { pts.current.delete(e.pointerId) }
  const onDouble = (e: React.MouseEvent) => {
    const { px, py, w, h } = geo(e.clientX, e.clientY)
    setV((v) => (v.s === 1 ? zoomAt(v, 1.5, px, py, w, h) : { s: 1, x: 0, y: 0 })) // 확대 중이면 원본으로
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="크게 보기" onKeyDown={trapTab} className="absolute inset-0 z-50 flex bg-black [animation:fade-in_140ms_ease-out]">
      <div ref={box} className="flex flex-1 overflow-hidden"
        {...(isVideo(url) ? {} : { onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp, onPointerCancel: onUp, onDoubleClick: onDouble, style: { touchAction: 'none' } })}>
        {isVideo(url)
          ? <video src={url} controls autoPlay playsInline className="m-auto max-h-full max-w-full" />
          : <img ref={img} src={url} alt="크게 본 사진" draggable={false}
            style={{ transform: `translate(${v.x}px, ${v.y}px) scale(${v.s})` }}
            className={`m-auto max-h-full max-w-full select-none object-contain ${v.s > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'}`} />}
      </div>
      {/* KLIPY GIF 는 사본을 남기면 안 되는 콘텐츠라 저장 버튼을 두지 않는다 */}
      {!isKlipyUrl(url) && (
        <button onClick={() => saveMedia(url).catch((e) => e?.name !== 'AbortError' && toast('저장하지 못했어요. 다시 시도해 주세요.'))}
          aria-label={isVideo(url) ? '영상 저장' : '사진 저장'}
          className="absolute right-14 top-[max(8px,env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white">
          <IconDownload />
        </button>
      )}
      <button onClick={onClose} aria-label="닫기" autoFocus
        className="absolute right-2 top-[max(8px,env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white">
        <IconClose />
      </button>
    </div>
  )
}

