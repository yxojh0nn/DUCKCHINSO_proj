import { useState } from 'react'
import { CONSENT_ITEMS, type ConsentItem } from '@/data/consent'
import { CheckMark } from './ui/Checkbox'
import { IconChevronDown } from './icons'

export const allRequired = (v: Record<string, boolean>) => CONSENT_ITEMS.every((c) => !c.required || v[c.key])

// 동의 항목 목록: 전체 동의 + 항목별 체크 + 전문 펼쳐보기 (기획서 9.2)
export function ConsentList({ value, onChange }: { value: Record<string, boolean>; onChange: (v: Record<string, boolean>) => void }) {
  const [open, setOpen] = useState<string | null>(null)
  const all = CONSENT_ITEMS.every((c) => value[c.key])
  const set = (key: string, on: boolean) => {
    const next = { ...value, [key]: on }
    // 야간 광고 수신은 광고성 수신에 동의한 경우에만
    if (key === 'marketing' && !on) next.nightMarketing = false
    if (key === 'nightMarketing' && on) next.marketing = true
    onChange(next)
  }
  return (
    <div>
      <button onClick={() => onChange(Object.fromEntries(CONSENT_ITEMS.map((c) => [c.key, !all])))} aria-pressed={all}
        className="flex min-h-14 w-full items-center gap-3 border-b border-hairline px-1 text-left t-head">
        <CheckMark checked={all} />전체 동의
      </button>
      <ul className="py-1">
        {CONSENT_ITEMS.map((c) => (
          <li key={c.key}>
            <div className="flex items-center">
              <button onClick={() => set(c.key, !value[c.key])} aria-pressed={!!value[c.key]} className="flex min-h-11 flex-1 items-center gap-3 px-1 text-left t-body">
                <CheckMark checked={!!value[c.key]} />
                <span>{c.required && <span className="font-semibold">[필수] </span>}{c.label.replace(' (선택)', '')}{!c.required && <span className="text-graphite"> (선택)</span>}</span>
              </button>
              <button aria-label={`${c.label} 전문 ${open === c.key ? '접기' : '보기'}`} aria-expanded={open === c.key}
                onClick={() => setOpen(open === c.key ? null : c.key)} className="flex h-11 w-11 items-center justify-center text-graphite">
                <IconChevronDown size={18} className={`transition-transform ${open === c.key ? 'rotate-180' : ''}`} />
              </button>
            </div>
            {open === c.key && <ConsentBody item={c} />}
          </li>
        ))}
      </ul>
    </div>
  )
}

// 동의 항목 전문 (가입 화면과 MY > 설정 > 동의 내역에서 함께 쓴다)
export function ConsentBody({ item }: { item: ConsentItem }) {
  return (
    <div className="mb-2 ml-9 mr-2 t-sub text-graphite">
      <p>{item.body}</p>
      {item.table && (
        <table className="mt-2 w-full border-collapse text-left text-[12px]">
          <tbody>
            {item.table.map((row, i) => (
              <tr key={i} className="border-b border-hairline">
                {row.map((cell, j) => i === 0
                  ? <th key={j} className="py-1.5 pr-2 font-semibold text-ink">{cell}</th>
                  : <td key={j} className="py-1.5 pr-2 align-top">{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
