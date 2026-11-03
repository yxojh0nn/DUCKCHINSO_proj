import { useEffect, useRef } from 'react'

type Props = {
  open: boolean
  title: string
  message?: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
  onClose: () => void
}

// 가운데 뜨는 확인 창 ("정말 로그아웃 하시겠습니까?" 등). 초점은 취소에 둔다
export function Confirm({ open, title, message, confirmLabel, danger, onConfirm, onClose }: Props) {
  const cancel = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    cancel.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/35 px-10 [animation:fade-in_140ms_ease-out]" onClick={onClose}>
      <div role="alertdialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[300px] rounded-[18px] bg-paper [animation:pop-in_160ms_ease-out]">
        <div className="px-5 pb-4 pt-5 text-center">
          <p className="t-head">{title}</p>
          {message && <p className="mt-1.5 t-sub text-graphite">{message}</p>}
        </div>
        <div className="grid grid-cols-2 border-t border-hairline">
          <button ref={cancel} onClick={onClose} className="h-12 border-r border-hairline t-body active:bg-mist">취소</button>
          <button onClick={onConfirm} className={`h-12 t-body font-semibold active:bg-mist ${danger ? 'text-danger' : ''}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
