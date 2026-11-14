import type { KeyboardEvent } from 'react'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

// 대화상자 안에서 Tab 이 바깥(뒤 화면)으로 나가지 않고 처음·끝을 오가게 한다. 대화상자 요소의 onKeyDown 에 붙인다
export function trapTab(e: KeyboardEvent<HTMLElement>) {
  if (e.key !== 'Tab') return
  const items = [...e.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE)]
  if (!items.length) return
  const first = items[0], last = items[items.length - 1]
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
}

// 탭 목록: 왼쪽·오른쪽 방향키로 옆 탭을 고르고 초점도 옮긴다 (Tab 키는 선택된 탭 하나에만 멈춘다)
export function tabArrows<T>(e: KeyboardEvent<HTMLElement>, values: T[], value: T, onChange: (v: T) => void) {
  const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
  if (!d || !values.length) return
  e.preventDefault()
  const i = (Math.max(0, values.indexOf(value)) + d + values.length) % values.length
  onChange(values[i])
  const tabs = e.currentTarget.closest('[role="tablist"]')?.querySelectorAll<HTMLElement>('[role="tab"]:not([disabled])')
  tabs?.[i]?.focus()
}
