import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// 화면 상태만 둔다. 서버 데이터는 TanStack Query (기획서 3.4 상태 관리 중복 규칙)
export type Theme = 'system' | 'light' | 'dark'
export type CalMode = 'marks' | 'names'
// action: 토스트 안의 되돌리기 버튼 (예: 친구 요청 "취소")
export type ToastMsg = { text: string; action?: { label: string; run: () => void } }

type UI = {
  theme: Theme
  calMode: CalMode
  pendingConsents: Record<string, boolean> | null // 이메일 가입 화면에서 받은 동의 → 첫 로그인 직후 저장
  toast: ToastMsg | null
  setTheme: (t: Theme) => void
  setCalMode: (m: CalMode) => void
  setPendingConsents: (c: Record<string, boolean> | null) => void
  showToast: (m: ToastMsg | null) => void
}

export const useUI = create<UI>()(
  persist(
    (set) => ({
      theme: 'system',
      calMode: 'marks',
      pendingConsents: null,
      toast: null,
      setTheme: (theme) => set({ theme }),
      setCalMode: (calMode) => set({ calMode }),
      setPendingConsents: (pendingConsents) => set({ pendingConsents }),
      showToast: (toast) => set({ toast }),
    }),
    { name: 'duckchinso-ui', partialize: ({ theme, calMode, pendingConsents }) => ({ theme, calMode, pendingConsents }) },
  ),
)

export const toast = (text: string, action?: ToastMsg['action']) => useUI.getState().showToast({ text, action })

let fadeTimer: ReturnType<typeof setTimeout> | undefined

// fade: 사용자가 바꿀 때만 천천히 (첫 화면 그릴 때는 바로)
export const applyTheme = (t: Theme, fade = false) => {
  const root = document.documentElement
  if (fade) {
    root.classList.add('theme-fade')
    clearTimeout(fadeTimer)
    fadeTimer = setTimeout(() => root.classList.remove('theme-fade'), 500)
  }
  if (t === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', t)
}
