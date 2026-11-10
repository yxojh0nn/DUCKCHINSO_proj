import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { colorOf } from '@/lib/calendar'
import { posterThumb, posterUrl } from '@/lib/poster'
import { IconClose } from './icons'

// 공연 포스터(썸네일). 이미지가 없으면 공연 색 + 제목으로 대신 그린다
// eager: 화면 맨 위에 바로 보이는 포스터(공연 상세)는 먼저 받는다
export function Poster({ id, url, title, className = '', eager }: { id: string; url: string | null; title: string; className?: string; eager?: boolean }) {
  const [failed, setFailed] = useState(false) // 썸네일 변환이 실패하면 원본으로
  if (url) {
    return (
      <img src={failed ? posterUrl(url) : posterThumb(url)} alt={`${title} 포스터`} onError={() => setFailed(true)}
        loading={eager ? 'eager' : 'lazy'} decoding="async" fetchPriority={eager ? 'high' : 'auto'}
        className={`bg-mist object-cover ${className}`} />
    )
  }
  return (
    <div aria-hidden className={`flex items-end overflow-hidden p-2 ${className}`} style={{ background: colorOf(id) }}>
      <span className="line-clamp-3 text-[11px] font-bold leading-tight text-white/95">{title}</span>
    </div>
  )
}

// 포스터 크게 보기: 원본을 세로로 화면에 맞추고, 나머지는 원래 화면이 반투명하게 비친다. 오른쪽 위 X·Esc·바깥 누르기로 닫기
// KOPIS 포스터 원본은 약 430px 라 크게 보면 흐리다 → 소개 이미지(폭 700~1000px)가 있으면 "공연 상세 이미지 보기"로 아래에 이어 보여 준다
export function PosterViewer({ url, title, intro = [], onClose }: { url: string; title: string; intro?: string[]; onClose: () => void }) {
  const close = useRef<HTMLButtonElement>(null)
  const [more, setMore] = useState(false) // 소개 이미지는 눌렀을 때만 받는다 (한 장이 수 MB)
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    close.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); prev?.focus({ preventScroll: true }) }
  }, [onClose])
  // 화면 전환 애니메이션(transform) 안에서는 fixed 가 화면 기준이 아니게 되므로 body 에 바로 그린다
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`${title} 포스터`} onClick={onClose}
      className="fixed inset-0 z-50 overflow-y-auto bg-black/55 [animation:fade-in_160ms_ease-out]">
      <div className="flex min-h-full flex-col items-center justify-center gap-4 px-4 py-14">
        <img src={posterUrl(url)} alt={`${title} 포스터`} onClick={(e) => e.stopPropagation()}
          className={`rounded-[10px] object-contain shadow-2xl [animation:pop-in_180ms_ease-out] ${more ? 'h-auto w-full max-w-[720px]' : 'max-h-[calc(100dvh-168px)] max-w-full'}`} />
        {intro.length > 0 && !more && (
          <button onClick={(e) => { e.stopPropagation(); setMore(true) }}
            className="h-11 rounded-full bg-white/90 px-5 t-sub font-semibold text-black active:opacity-75">공연 상세 이미지 보기</button>
        )}
        {more && intro.map((u, i) => (
          <img key={u} src={posterUrl(u)} alt={`${title} 상세 이미지 ${i + 1}`} loading="lazy" decoding="async" onClick={(e) => e.stopPropagation()}
            className="h-auto w-full max-w-[720px] rounded-[10px] bg-white/10" />
        ))}
        {more && <p className="t-cap text-white/80">이미지 출처: (재)예술경영지원센터 공연예술통합전산망(KOPIS)</p>}
      </div>
      <button ref={close} onClick={onClose} aria-label="포스터 닫기"
        className="fixed right-3 top-[max(12px,env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-full bg-black/55 text-white">
        <IconClose size={22} />
      </button>
    </div>,
    document.body,
  )
}
