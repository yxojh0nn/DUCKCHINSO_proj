import { useEffect, useRef } from 'react'

type Action = { label: string; onClick: () => void; danger?: boolean }

type Props = {
  open: boolean
  onClose: () => void
  title?: string
  message?: string
  actions?: Action[]
  children?: React.ReactNode
}

// 아래에서 올라오는 선택지. 취소 버튼에 초점을 둬서 Enter 연타로 위험 동작이 실행되지 않게 한다
// preventScroll: 초점 이동이 뒤 화면 스크롤을 움직여 화면이 흔들리던 문제 방지
export function Sheet({ open, onClose, title, message, actions, children }: Props) {
  const cancel = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    cancel.current?.focus({ preventScroll: true })
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); prev?.focus({ preventScroll: true }) }
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="absolute inset-0 z-40 flex items-end bg-black/35 [animation:fade-in_160ms_ease-out]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title ?? '선택'}
        className="w-full px-2 pb-[max(8px,env(safe-area-inset-bottom))] [animation:sheet-up_240ms_cubic-bezier(.2,.9,.25,1)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-hidden rounded-[16px] bg-paper">
          {(title || message) && (
            <div className="px-5 pb-2 pt-4 text-center">
              {title && <p className="t-sub font-semibold text-graphite">{title}</p>}
              {message && <p className="mt-1 t-sub text-graphite">{message}</p>}
            </div>
          )}
          {children}
          {actions?.map((a) => (
            <button
              key={a.label}
              onClick={a.onClick}
              className={`block h-14 w-full border-t border-hairline text-[17px] first:border-0 active:bg-mist ${a.danger ? 'text-danger' : 'text-ink'}`}
            >
              {a.label}
            </button>
          ))}
          <button ref={cancel} onClick={onClose} className="block h-14 w-full border-t-[6px] border-mist text-[17px] font-semibold active:bg-mist">
            취소
          </button>
        </div>
      </div>
    </div>
  )
}
