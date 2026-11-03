import { useEffect } from 'react'
import { useAppStore } from '@/store/useAppStore'

export function Toast() {
  const toast = useAppStore((s) => s.toast)
  const showToast = useAppStore((s) => s.showToast)
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => showToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast, showToast])
  if (!toast) return null
  return (
    <div className="pointer-events-none absolute inset-x-4 top-3 z-50 flex justify-center">
      <div role="status" className="rounded-full bg-ink/90 px-4 py-2.5 t-sub font-medium text-paper backdrop-blur [animation:fade-in_160ms_ease-out]">
        {toast}
      </div>
    </div>
  )
}
