import { useEffect } from 'react'
import { useUI } from '@/store/ui'

// 되돌리기 버튼이 있으면 누를 시간을 더 준다
export function Toast() {
  const toast = useUI((s) => s.toast)
  const showToast = useUI((s) => s.showToast)
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => showToast(null), toast.action ? 5000 : 2600)
    return () => clearTimeout(t)
  }, [toast, showToast])
  if (!toast) return null
  const { text, action } = toast
  return (
    <div className="pointer-events-none absolute inset-x-4 top-[max(12px,env(safe-area-inset-top))] z-[60] md:bottom-8 md:top-auto flex justify-center">
      <div role="status" className={`flex items-center gap-3 rounded-full bg-ink py-2.5 pl-4 t-sub font-medium text-paper [animation:fade-in_160ms_ease-out] ${action ? 'pointer-events-auto pr-1.5' : 'pr-4'}`}>
        <span>{text}</span>
        {action && (
          <button onClick={() => { showToast(null); action.run() }}
            className="-my-1.5 flex h-9 items-center rounded-full px-3 font-semibold underline underline-offset-4 active:opacity-70">
            {action.label}
          </button>
        )}
      </div>
    </div>
  )
}
