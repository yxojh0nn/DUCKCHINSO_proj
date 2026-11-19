import { useQueryClient } from '@tanstack/react-query'
import { api, errorText } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { MenuGroup, MenuRow } from '@/components/MenuRow'
import { Segmented } from '@/components/ui/Segmented'
import { Toggle } from '@/components/ui/Toggle'
import { keys, useMe, useRecapPublic } from '@/lib/queries'
import { toast, useUI, type Theme } from '@/store/ui'

// 알림 종류 (docs/푸시_알림_설계.md 2장과 같은 묶음)
const NOTIFY = [
  { key: 'friend', label: '친구 요청', desc: '덕친 요청을 받았을 때, 내 요청을 상대가 수락했을 때' },
  { key: 'like', label: '좋아요', desc: '내 글이나 공연 후기를 누군가 추천했을 때' },
  { key: 'comment', label: '댓글', desc: '내 글·공연 후기에 댓글이 달렸을 때, 내 댓글에 답글이 달렸을 때' },
  { key: 'concert', label: '공연 알림', desc: '관심 아티스트의 새 공연이 등록됐을 때, 관심 공연 예매 오픈 전날과 공연 전날' },
] as const

// 설정: 알림(종류별), 테마(다크), 광고성 정보 수신(동의 철회 포함)
export default function Settings() {
  const qc = useQueryClient()
  const me = useMe().data
  const { theme, setTheme } = useUI()
  const recapPublic = useRecapPublic(!!me && !me.isGuest)
  if (!me) return null

  const setConsent = async (values: Record<string, boolean>, done: string) => {
    try {
      // 동의·철회 모두 이력으로 남는다 (consents 테이블)
      await api.saveConsents(values)
      if ('push' in values) await api.updateMe({ notifyEnabled: values.push })
      await qc.invalidateQueries({ queryKey: keys.me })
      toast(done)
    } catch (e) { toast(errorText(e)) }
  }
  const push = !!me.consents.push && me.notifyEnabled
  const setNotify = async (k: keyof typeof me.notify, v: boolean) => {
    try {
      await api.updateMe({ notify: { [k]: v } })
      await qc.invalidateQueries({ queryKey: keys.me })
    } catch (e) { toast(errorText(e)) }
  }
  const ads = !!me.consents.marketing
  const night = !!me.consents.nightMarketing

  return (
    <>
      <AppHeader back title="설정" />
      <MenuGroup title="알림">
        <MenuRow label="서비스 알림" right={
          <Toggle label="서비스 알림" checked={push} onChange={(v) => setConsent({ push: v }, v ? '알림을 켰어요' : '알림을 껐어요')} />} />
        {/* 종류별: 서비스 알림이 켜져 있을 때만 바꿀 수 있다. 채팅·운영팀 안내는 서비스 알림을 따른다 */}
        {NOTIFY.map((n) => (
          <li key={n.key} className={`flex items-start gap-3 py-3 pl-9 pr-5 ${push ? '' : 'opacity-40'}`}>
            <div className="min-w-0 flex-1">
              <p className="t-body">{n.label}</p>
              <p className="mt-0.5 t-cap text-graphite">{n.desc}</p>
            </div>
            <Toggle label={n.label.endsWith('알림') ? n.label : `${n.label} 알림`} checked={push && me.notify[n.key]} disabled={!push} onChange={(v) => setNotify(n.key, v)} />
          </li>
        ))}
        <MenuRow label="광고성 정보 수신" right={
          <Toggle label="광고성 정보 수신" checked={ads} onChange={(v) => setConsent(v ? { marketing: true } : { marketing: false, nightMarketing: false }, v ? '광고성 정보 수신에 동의했어요' : '광고성 정보 수신을 철회했어요')} />} />
        <MenuRow label="야간(21시~08시) 광고성 정보 수신" right={
          <Toggle label="야간 광고성 정보 수신" checked={night} onChange={(v) => {
            if (v && !ads) return toast('광고성 정보 수신에 먼저 동의해 주세요')
            setConsent({ nightMarketing: v }, v ? '야간 수신에 동의했어요' : '야간 수신을 철회했어요')
          }} />} />
      </MenuGroup>

      {!me.isGuest && (
        <MenuGroup title="공개 범위">
          <li className="flex items-start gap-3 px-5 py-3">
            <div className="min-w-0 flex-1">
              <p className="t-body">내 리캡 공개</p>
              <p className="mt-0.5 t-cap text-graphite">켜면 내 프로필에서 다른 사람도 리캡 카드를 볼 수 있어요. 덕질 사진은 늘 나만 봐요.</p>
            </div>
            <Toggle label="내 리캡 공개" checked={recapPublic.data ?? true} onChange={async (v) => {
              try {
                await api.setRecapPublic(v)
                await qc.invalidateQueries({ queryKey: keys.recapPublic })
                toast(v ? '리캡을 공개했어요' : '리캡을 나만 보게 했어요')
              } catch (e) { toast(errorText(e)) }
            }} />
          </li>
        </MenuGroup>
      )}

      <MenuGroup title="테마">
        <li className="px-5 py-2">
          <Segmented<Theme> label="테마" value={theme} onChange={setTheme}
            options={[{ value: 'system', label: '기기 설정' }, { value: 'light', label: '라이트' }, { value: 'dark', label: '다크' }]} />
        </li>
      </MenuGroup>

      <MenuGroup title="약관">
        <MenuRow label="동의 내역" to="/my/settings/consents" />
      </MenuGroup>

      <MenuGroup title="앱 정보">
        <MenuRow label="오픈 API" to="/my/settings/api" />
      </MenuGroup>
    </>
  )
}
