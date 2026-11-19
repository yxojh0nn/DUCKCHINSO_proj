import { useState } from 'react'
import { IconCheck, IconChevronDown } from '@/components/icons'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { Toggle } from '@/components/ui/Toggle'
import { REGIONS, nearestRegion } from '@/data/regions'
import { SETTINGS_HINT, getPosition } from '@/lib/permissions'
import { toast } from '@/store/ui'

// 활동 지역(선택) + 공개 여부. 프로필 설정 첫 단계와 프로필 편집에서 같이 쓴다
// 비공개·미입력: 프로필에 지역이 안 보이고, 덕친 추천의 '가까운 사람 먼저'가 적용되지 않는다 (서버 recommend_friends·profile_card)
export function RegionField({ region, onRegion, isPublic, onPublic }: {
  region: string; onRegion: (v: string) => void; isPublic: boolean; onPublic: (v: boolean) => void
}) {
  const [locating, setLocating] = useState(false)
  const [picking, setPicking] = useState(false)
  const pick = (v: string) => { onRegion(v); setPicking(false) }
  // 기기 위치 → 가장 가까운 시·도 (좌표는 이 함수 밖으로 나가지 않는다)
  const locate = async () => {
    setLocating(true)
    try {
      const p = await getPosition()
      onRegion(nearestRegion(p.coords.latitude, p.coords.longitude))
    } catch { toast(`위치를 가져오지 못했어요. 위치 권한이 꺼져 있다면 ${SETTINGS_HINT}`) }
    finally { setLocating(false) }
  }
  return (
    <div>
      <p id="region-label" className="t-sub font-semibold text-graphite">활동 지역 (선택)</p>
      <div className="mt-1 flex items-center gap-2">
        {/* 기본 select 는 펼친 목록이 기기 기본 색(라이트)으로 떠서, 앱 테마를 따르는 시트로 고른다 */}
        <button type="button" aria-labelledby="region-label region-value" aria-haspopup="dialog" onClick={() => setPicking(true)}
          className="flex h-11 min-w-0 flex-1 items-center justify-between border-b border-control-line text-left t-body outline-none focus-visible:border-ink focus-visible:shadow-[inset_0_-1px_0_var(--ink)]">
          <span id="region-value" className={region ? '' : 'text-graphite'}>{region || '입력 안 함'}</span>
          <IconChevronDown size={18} className="shrink-0 text-graphite" />
        </button>
        <Button size="sm" variant="secondary" disabled={locating} onClick={locate}>{locating ? '찾는 중…' : '현재 위치로'}</Button>
      </div>
      <Sheet open={picking} onClose={() => setPicking(false)} title="활동 지역">
        <div role="radiogroup" aria-label="활동 지역" className="grid grid-cols-3 gap-2 px-4 pb-4 pt-1 md:grid-cols-4">
          {['', ...REGIONS.map((r) => r.name)].map((name) => {
            const on = region === name
            return (
              <button key={name || 'none'} role="radio" aria-checked={on} onClick={() => pick(name)}
                className={`flex h-11 items-center justify-center gap-1 rounded-[10px] t-body active:opacity-70 ${on ? 'bg-ink font-semibold text-paper' : 'bg-mist text-ink'} ${name ? '' : 'col-span-3 md:col-span-4'}`}>
                {on && <IconCheck size={16} />}{name || '입력 안 함'}
              </button>
            )
          })}
        </div>
      </Sheet>
      {region && (
        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="t-body">프로필에 지역 공개</span>
          <Toggle label="프로필에 지역 공개" checked={isPublic} onChange={onPublic} />
        </div>
      )}
      <p role={region && !isPublic ? 'status' : undefined}
        className={`mt-1.5 t-sub ${region && !isPublic ? 'rounded-[10px] bg-mist px-3 py-2 text-ink' : 'text-graphite'}`}>
        {!region ? '입력하지 않으면 프로필에 지역이 보이지 않고, 가까운 지역의 덕친을 먼저 추천하지 않아요.'
          : isPublic ? '프로필에 보이고, 가까운 지역의 덕친을 먼저 추천해요. 현재 위치는 기기 안에서 시·도를 고르는 데만 쓰고 저장하지 않아요.'
          : '지역을 공개하지 않으면 프로필에 보이지 않고, 가까운 지역의 덕친을 먼저 추천하는 기능도 적용되지 않아요. 다른 사람의 추천에서도 가까운 사람으로 잡히지 않아요.'}
      </p>
    </div>
  )
}
