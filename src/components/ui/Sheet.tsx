import { useEffect } from 'react'

type Action = { label: string; onClick: () => void; destructive?: boolean }

type Props = {
  open: boolean
  onClose: () => void
  title?: string
  message?: string
  actions?: Action[]
  children?: React.ReactNode
}

// iOS 액션 시트: 둥근 버튼 묶음 + 분리된 취소 버튼
export function Sheet({ open, onClose, title, message, actions, children }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="absolute inset-0 z-40 flex items-end bg-black/30 [animation:fade-in_160ms_ease-out]" onClick={onClose}>
      <div
        role="dialog"
        aria-label={title}
        className="w-full px-2 pb-[max(8px,env(safe-area-inset-bottom))] [animation:sheet-up_260ms_cubic-bezier(.2,.9,.25,1)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="overflow-hidden rounded-[14px] bg-paper/95 backdrop-blur-xl">
          {(title || message) && (
            <div className="border-b border-hairline/70 px-4 py-3.5 text-center">
              {title && <p className="t-sub font-semibold text-graphite">{title}</p>}
              {message && <p className="mt-1 t-sub text-graphite">{message}</p>}
            </div>
          )}
          {children}
          {actions?.map((a) => (
            <button
              key={a.label}
              onClick={a.onClick}
              className={`block h-14 w-full border-b border-hairline/70 text-[17px] last:border-0 active:bg-mist ${a.destructive ? 'text-danger' : 'text-azure'}`}
            >
              {a.label}
            </button>
          ))}
        </div>
        <button onClick={onClose} className="mt-2 h-14 w-full rounded-[14px] bg-paper text-[17px] font-semibold text-azure active:bg-mist">
          취소
        </button>
      </div>
    </div>
  )
}
