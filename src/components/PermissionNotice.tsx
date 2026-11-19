import { useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { PERMISSIONS } from '@/lib/permissions'
import { Button } from './ui/Button'
import { trapTab, useDialogFocus } from './ui/a11y'

const SEEN = 'permission-notice-v1'
const seen = () => { try { return localStorage.getItem(SEEN) === '1' } catch { return false } }

// 앱 첫 실행 때 한 번: 접근 권한 안내 (정보통신망법 22조의2). 웹은 브라우저가 따로 묻기 때문에 앱에서만
export function PermissionNotice() {
  const [open, setOpen] = useState(() => Capacitor.isNativePlatform() && !seen())
  const close = () => { try { localStorage.setItem(SEEN, '1') } catch { /* 못 저장하면 다음 실행에 한 번 더 */ } setOpen(false) }
  useDialogFocus(open, close)
  if (!open) return null
  const ios = Capacitor.getPlatform() === 'ios'
  return (
    <div className="absolute inset-0 z-50 flex items-end bg-black/35 md:items-center">
      <div role="dialog" aria-modal="true" aria-labelledby="perm-title" onKeyDown={trapTab}
        className="mx-auto w-full max-w-[440px] rounded-t-[20px] bg-paper px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-6 md:rounded-[20px]">
        <h2 id="perm-title" className="t-title">앱 접근 권한 안내</h2>
        <p className="mt-1 t-sub text-graphite">덕친소는 꼭 필요한 권한이 없어요. 아래 권한은 모두 <b className="text-ink">선택</b>이며, 그 기능을 처음 쓸 때 물어봐요. 허용하지 않아도 다른 기능은 그대로 쓸 수 있어요.</p>
        <ul className="mt-4 space-y-3">
          {PERMISSIONS.filter((p) => !p.ios || ios).map((p) => (
            <li key={p.key}><p className="t-body font-semibold">{p.label} <span className="t-cap font-normal text-graphite">(선택)</span></p><p className="t-sub text-graphite">{p.why}</p></li>
          ))}
        </ul>
        <p className="mt-4 t-cap text-graphite">MY › 설정 › 앱 접근 권한에서 언제든 확인하고 바꿀 수 있어요.</p>
        <Button block className="mt-4" onClick={close}>확인</Button>
      </div>
    </div>
  )
}
