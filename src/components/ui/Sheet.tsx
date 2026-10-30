import { useEffect } from 'react'

type Props = { open: boolean; onClose: () => void; title?: string; children: React.ReactNode }

// 하단에서 올라오는 시트. 확인 창·메뉴에 공통으로 쓴다
export function Sheet({ open, onClose, title, children }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="absolute inset-0 z-40 flex items-end bg-black/40" onClick={onClose}>
      <div className="w-full rounded-t-2xl bg-surface p-5 pb-7" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        {title && <h2 className="mb-3 text-base font-bold">{title}</h2>}
        {children}
      </div>
    </div>
  )
}
