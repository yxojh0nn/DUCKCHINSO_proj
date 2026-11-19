import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { AppHeader } from '@/components/AppHeader'
import { Button } from '@/components/ui/Button'
import { PERMISSIONS, SETTINGS_HINT, askPermission, openAppSettings, permState, type PermKey, type PermState } from '@/lib/permissions'
import { toast } from '@/store/ui'

const STATE_LABEL: Record<PermState, string> = { granted: '허용됨', denied: '거부됨', prompt: '아직 묻지 않음', unknown: '쓸 때 물어봐요' }

// MY > 설정 > 앱 접근 권한: 항목·이유·상태, 허용하기 / 거부했으면 설정에서 켜기
export default function Permissions() {
  const ios = Capacitor.getPlatform() === 'ios'
  const list = PERMISSIONS.filter((p) => !p.ios || ios)
  const [state, setState] = useState<Partial<Record<PermKey, PermState>>>({})
  const refresh = () => Promise.all(list.map(async (p) => [p.key, await permState(p.key)] as const)).then((e) => setState(Object.fromEntries(e)))
  useEffect(() => { refresh() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const ask = async (key: PermKey) => {
    const ok = await askPermission(key)
    await refresh()
    if (!ok) toast(`권한이 꺼져 있어요. ${SETTINGS_HINT}`)
  }
  const settings = async () => { if (!(await openAppSettings())) toast(SETTINGS_HINT) }

  return (
    <>
      <AppHeader back title="앱 접근 권한" />
      <p className="px-5 pt-2 t-sub text-graphite">덕친소는 꼭 필요한 권한이 없어요. 아래 권한은 모두 선택이며, 허용하지 않아도 다른 기능은 그대로 쓸 수 있어요. 각 기능을 처음 쓸 때 기기가 한 번 물어봐요.</p>
      <ul className="mt-4 divide-y divide-hairline border-y border-hairline">
        {list.map((p) => {
          const s = state[p.key] ?? 'unknown'
          return (
            <li key={p.key} className="px-5 py-4">
              <div className="flex items-center gap-2">
                <p className="t-body font-semibold">{p.label}</p>
                <span className="rounded-full bg-mist px-2 py-0.5 t-cap text-graphite">선택</span>
                <span className={`ml-auto t-sub ${s === 'granted' ? 'text-success' : s === 'denied' ? 'text-danger' : 'text-graphite'}`}>{STATE_LABEL[s]}</span>
              </div>
              <p className="mt-1 t-sub text-graphite">{p.why}</p>
              {p.key !== 'photos' && s !== 'granted' && (
                <div className="mt-3">
                  {s === 'denied'
                    ? <Button size="sm" variant="secondary" onClick={settings}>설정에서 켜기</Button>
                    : <Button size="sm" variant="secondary" onClick={() => ask(p.key)}>허용하기</Button>}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <p className="px-5 pt-3 t-cap text-graphite">허용한 권한을 끄려면 {SETTINGS_HINT.replace('켤 수 있어요', '끌 수 있어요')}</p>
    </>
  )
}
