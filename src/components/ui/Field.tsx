import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

// 입력창: 상자 대신 밑줄 한 줄 (과한 박스 자제)
type Base = { label: string; hint?: string; error?: string; invalid?: boolean }

// invalid: 문구 없이 밑줄만 붉게 (로그인 실패처럼 문구를 다른 곳에 한 번만 보일 때)
export function TextField({ label, hint, error, invalid, className = '', ...rest }: Base & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`block ${className}`}>
      <span className="t-sub font-semibold text-graphite">{label}</span>
      <input aria-invalid={invalid || !!error || undefined}
        className={`mt-1 block h-11 w-full border-b outline-none transition-colors t-body ${invalid || error ? 'border-danger' : 'border-hairline focus:border-ink'}`} {...rest} />
      {(error || hint) && <span className={`mt-1 block t-sub ${error ? 'text-danger' : 'text-graphite'}`}>{error ?? hint}</span>}
    </label>
  )
}

export function TextArea({ label, hint, error, className = '', ...rest }: Base & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className={`block ${className}`}>
      <span className="t-sub font-semibold text-graphite">{label}</span>
      <textarea className="mt-1 block w-full resize-none border-b border-hairline py-2 outline-none transition-colors focus:border-ink t-body" {...rest} />
      {(error || hint) && <span className={`mt-1 block t-sub ${error ? 'text-danger' : 'text-graphite'}`}>{error ?? hint}</span>}
    </label>
  )
}
