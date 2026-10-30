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
    <div className="pointer-events-none absolute inset-x-4 top-14 z-50 flex justify-center">
      <div className="rounded-xl bg-ink px-4 py-2.5 text-sm text-surface shadow-lg" role="status">{toast}</div>
    </div>
  )
}
