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
    <div className="flex min-h-full flex-col">
      <div className="flex-1 px-5 pt-16">
        <h1 className="t-large">
          J-pop 공연과
          <br />
          같이 갈 사람을 찾아요
        </h1>
        <p className="mt-3 t-body text-graphite">가입 없이 바로 시작해요. 아래 내용을 확인하고 동의해 주세요.</p>

        <div className="mt-8 border-b border-hairline/70 pb-1">
          <Checkbox checked={all} onChange={setAll} strong>모두 동의</Checkbox>
        </div>
        <ul>
          {CONSENT_ITEMS.map((i) => (
            <li key={i.key}>
              <div className="flex items-center">
                <Checkbox checked={!!checked[i.key]} onChange={(v) => setChecked({ ...checked, [i.key]: v })}>
                  <span>
                    {i.label.replace(' (선택)', '')}
                    <span className="ml-1.5 t-sub text-graphite">{i.required ? '필수' : '선택'}</span>
                  </span>
                </Checkbox>
                <button
                  aria-expanded={open === i.key}
                  aria-label={`${i.label} 내용 보기`}
                  className="flex h-11 w-11 items-center justify-center text-graphite"
                  onClick={() => setOpen(open === i.key ? null : i.key)}
                >
                  <svg aria-hidden viewBox="0 0 14 8" className={`h-2 w-3.5 transition-transform ${open === i.key ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M1 1l6 6 6-6" /></svg>
                </button>
              </div>
              {open === i.key && <p className="mb-3 ml-[34px] t-sub text-graphite">{i.body}</p>}
            </li>
          ))}
        </ul>
        <p className="mt-6 t-sub text-graphite">
          대화 중 티켓 사기, 암표 거래, 괴롭힘처럼 법률이나 운영정책을 어기면 계정이 정지될 수 있어요.
        </p>
      </div>
      <div className="sticky bottom-0 bg-paper/90 px-5 pb-6 pt-3 backdrop-blur-xl">
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
