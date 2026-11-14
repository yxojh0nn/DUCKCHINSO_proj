import { useId, useState, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react'
import { IconCheck, IconEye, IconEyeOff } from '@/components/icons'

// 입력창: 상자 대신 밑줄 한 줄 (과한 박스 자제). 초점이 오면 밑줄만 굵어진다
// (inset 그림자로 1px 더해 굵게 → 높이가 변하지 않아 글자가 흔들리지 않음)
type Base = { label: string; hint?: string; error?: string; invalid?: boolean }
const LINE = 'border-b outline-none transition-[border-color,box-shadow] t-body'
const lineColor = (bad: boolean) => bad
  ? 'border-danger focus:shadow-[inset_0_-1px_0_var(--danger)]'
  : 'border-control-line focus:border-ink focus:shadow-[inset_0_-1px_0_var(--ink)]'

// invalid: 문구 없이 밑줄만 붉게 (로그인 실패처럼 문구를 다른 곳에 한 번만 보일 때)
// success: 초록 체크와 문구 / action: 입력란 오른쪽 버튼 (중복 확인 등)
// type="password": 처음엔 점으로 가리고, 오른쪽 눈 버튼으로 보기·숨기기
export function TextField({ label, hint, error, invalid, success, action, className = '', type, id, ...rest }: Base & { success?: string; action?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  const [shown, setShown] = useState(false)
  const auto = useId()
  const password = type === 'password'
  const bad = !!(invalid || error)
  return (
    <div className={className}>
      <label htmlFor={id ?? auto} className="block t-sub font-semibold text-graphite">{label}</label>
      <div className="mt-1 flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <input id={id ?? auto} aria-invalid={bad || undefined} type={password && shown ? 'text' : type}
            className={`block h-11 w-full ${password ? 'pr-11' : ''} ${LINE} ${lineColor(bad)}`} {...rest} />
          {password && (
            <button type="button" onClick={() => setShown((v) => !v)} aria-pressed={shown}
              aria-label={shown ? '비밀번호 숨기기' : '비밀번호 보기'}
              className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-graphite">
              {shown ? <IconEyeOff className="h-5 w-5" /> : <IconEye className="h-5 w-5" />}
            </button>
          )}
        </div>
        {action}
      </div>
      {error ? <span role="alert" className="mt-1 block t-sub text-danger">{error}</span>
        : success ? <span role="status" className="mt-1 flex items-center gap-1 t-sub text-success"><IconCheck size={16} />{success}</span>
        : hint && <span className="mt-1 block t-sub text-graphite">{hint}</span>}
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
