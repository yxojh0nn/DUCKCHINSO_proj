import { useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { IconEye, IconEyeOff } from '@/components/icons'

// 입력창: 상자 대신 밑줄 한 줄 (과한 박스 자제). 초점이 오면 밑줄만 굵어진다
// (inset 그림자로 1px 더해 굵게 → 높이가 변하지 않아 글자가 흔들리지 않음)
type Base = { label: string; hint?: string; error?: string; invalid?: boolean }
const LINE = 'border-b outline-none transition-[border-color,box-shadow] t-body'
const lineColor = (bad: boolean) => bad
  ? 'border-danger focus:shadow-[inset_0_-1px_0_var(--danger)]'
  : 'border-hairline focus:border-ink focus:shadow-[inset_0_-1px_0_var(--ink)]'

// invalid: 문구 없이 밑줄만 붉게 (로그인 실패처럼 문구를 다른 곳에 한 번만 보일 때)
// type="password": 처음엔 점으로 가리고, 오른쪽 눈 버튼으로 보기·숨기기
export function TextField({ label, hint, error, invalid, className = '', type, ...rest }: Base & InputHTMLAttributes<HTMLInputElement>) {
  const [shown, setShown] = useState(false)
  const password = type === 'password'
  const bad = !!(invalid || error)
  return (
    <div className={className}>
      <label className="block">
        <span className="t-sub font-semibold text-graphite">{label}</span>
        <input aria-invalid={bad || undefined} type={password && shown ? 'text' : type}
          className={`mt-1 block h-11 w-full ${password ? 'pr-11' : ''} ${LINE} ${lineColor(bad)}`} {...rest} />
      </label>
      {password && (
        <div className="relative">
          <button type="button" onClick={() => setShown((v) => !v)} aria-pressed={shown}
            aria-label={shown ? '비밀번호 숨기기' : '비밀번호 보기'}
            className="absolute -top-11 right-0 flex h-11 w-11 items-center justify-center text-graphite">
            {shown ? <IconEyeOff className="h-5 w-5" /> : <IconEye className="h-5 w-5" />}
          </button>
        </div>
      )}
      {(error || hint) && <span className={`mt-1 block t-sub ${error ? 'text-danger' : 'text-graphite'}`}>{error ?? hint}</span>}
    </div>
  )
}

export function TextArea({ label, hint, error, className = '', ...rest }: Base & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className={`block ${className}`}>
      <span className="t-sub font-semibold text-graphite">{label}</span>
      <textarea className={`mt-1 block w-full resize-none py-2 ${LINE} ${lineColor(!!error)}`} {...rest} />
      {(error || hint) && <span className={`mt-1 block t-sub ${error ? 'text-danger' : 'text-graphite'}`}>{error ?? hint}</span>}
    </label>
  )
}
