import { useState } from 'react'
import { AppHeader } from '@/components/AppHeader'
import { ConsentBody } from '@/components/ConsentList'
import { IconChevronDown } from '@/components/icons'
import { CONSENT_ITEMS, CONSENT_VERSION } from '@/data/consent'
import { useMe } from '@/lib/queries'

// MY > 설정 > 동의 내역: 항목별 동의 상태와 전문 다시 보기
export default function ConsentHistory() {
  const me = useMe().data
  const [open, setOpen] = useState<string | null>(null)
  if (!me) return null
  return (
    <>
      <AppHeader back title="동의 내역" />
      <p className="px-5 pb-2 pt-1 t-cap text-graphite num">약관 버전 {CONSENT_VERSION}</p>
      <ul>
        {CONSENT_ITEMS.map((c) => (
          <li key={c.key} className="border-b border-hairline px-4">
            <button aria-expanded={open === c.key} onClick={() => setOpen(open === c.key ? null : c.key)}
              className="flex min-h-[52px] w-full items-center gap-3 text-left">
              <span className="flex-1 t-body">{c.label.replace(' (선택)', '')}{!c.required && <span className="text-graphite"> (선택)</span>}</span>
              <span className={`t-sub ${me.consents[c.key] ? 'text-ink' : 'text-graphite'}`}>{me.consents[c.key] ? '동의함' : '동의 안 함'}</span>
              <IconChevronDown size={18} className={`text-graphite transition-transform ${open === c.key ? 'rotate-180' : ''}`} />
            </button>
            {open === c.key && <ConsentBody item={c} />}
          </li>
        ))}
      </ul>
    </>
  )
}
