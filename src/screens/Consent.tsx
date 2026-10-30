import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CONSENT_ITEMS } from '@/data/consent'
import { useAppStore } from '@/store/useAppStore'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'

// 첫 진입 동의 화면 (기획서 9.2). 동의 후 임시 계정을 만든다
export default function Consent() {
  const nav = useNavigate()
  const acceptConsent = useAppStore((s) => s.acceptConsent)
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [open, setOpen] = useState<string | null>(null)

  const all = CONSENT_ITEMS.every((i) => checked[i.key])
  const requiredOk = CONSENT_ITEMS.filter((i) => i.required).every((i) => checked[i.key])
  const setAll = (v: boolean) => setChecked(Object.fromEntries(CONSENT_ITEMS.map((i) => [i.key, v])))

  return (
    <div className="flex min-h-full flex-col bg-surface">
      <div className="flex-1 overflow-y-auto px-5 pt-10">
        <p className="text-sm font-semibold text-accent">덕친소</p>
        <h1 className="mb-1 mt-1 text-2xl font-bold leading-snug">J-pop 공연과 덕친을<br />한 곳에서</h1>
        <p className="mb-6 text-sm text-muted">시작하려면 아래 내용에 동의해 주세요. 가입 없이 임시 계정으로 바로 이용할 수 있어요.</p>

        <div className="mb-2 rounded-2xl bg-chip px-4">
          <Checkbox checked={all} onChange={setAll} strong>전체 동의 (선택 항목 포함)</Checkbox>
        </div>
        <ul className="px-1">
          {CONSENT_ITEMS.map((i) => (
            <li key={i.key} className="border-b border-line last:border-0">
              <div className="flex items-center">
                <Checkbox checked={!!checked[i.key]} onChange={(v) => setChecked({ ...checked, [i.key]: v })}>
                  <span>
                    <span className={i.required ? 'text-accent' : 'text-muted'}>[{i.required ? '필수' : '선택'}]</span>{' '}
                    {i.label.replace(' (선택)', '')}
                  </span>
                </Checkbox>
                <button className="px-2 py-1 text-xs text-muted underline" onClick={() => setOpen(open === i.key ? null : i.key)}>
                  {open === i.key ? '닫기' : '보기'}
                </button>
              </div>
              {open === i.key && <p className="mb-3 rounded-xl bg-chip p-3 text-xs leading-relaxed text-muted">{i.body}</p>}
            </li>
          ))}
        </ul>
        <p className="mt-4 rounded-xl border border-warn/40 bg-warn/10 p-3 text-xs leading-relaxed text-warn">
          대화 중 티켓 사기·암표 거래·괴롭힘 등 법률이나 운영정책을 위반하면 계정이 정지될 수 있어요.
        </p>
      </div>
      <div className="p-5">
        <Button
          block
          disabled={!requiredOk}
          onClick={() => {
            acceptConsent(Object.fromEntries(CONSENT_ITEMS.map((i) => [i.key, !!checked[i.key]])))
            nav('/setup', { replace: true })
          }}
        >
          동의하고 시작하기
        </Button>
      </div>
    </div>
  )
}
