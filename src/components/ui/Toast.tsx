import { useEffect } from 'react'
import { useUI } from '@/store/ui'

export function Toast() {
  const toast = useUI((s) => s.toast)
  const showToast = useUI((s) => s.showToast)
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => showToast(null), 2600)
    return () => clearTimeout(t)
  }, [toast, showToast])
  if (!toast) return null
  return (
    <div className="pointer-events-none absolute inset-x-4 top-[max(12px,env(safe-area-inset-top))] z-[60] flex justify-center">
      <div role="status" className="rounded-full bg-ink px-4 py-2.5 t-sub font-medium text-paper [animation:fade-in_160ms_ease-out]">
        {toast}
      </div>
    </div>
  )
}
