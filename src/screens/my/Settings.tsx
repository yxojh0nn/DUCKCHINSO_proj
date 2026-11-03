import { useQueryClient } from '@tanstack/react-query'
import { api, errorText } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { MenuGroup, MenuRow } from '@/components/MenuRow'
import { Segmented } from '@/components/ui/Segmented'
import { Toggle } from '@/components/ui/Toggle'
import { keys, useMe } from '@/lib/queries'
import { toast, useUI, type Theme } from '@/store/ui'

// 설정: 알림, 테마(다크), 광고성 정보 수신(동의 철회 포함)
export default function Settings() {
  const qc = useQueryClient()
  const me = useMe().data
  const { theme, setTheme } = useUI()
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
  const ads = !!me.consents.marketing
  const night = !!me.consents.nightMarketing

  return (
    <>
      <AppHeader back title="설정" />
      <MenuGroup title="알림">
        <MenuRow label="서비스 알림 (친구 요청·채팅·예매 오픈)" right={
          <Toggle label="서비스 알림" checked={push} onChange={(v) => setConsent({ push: v }, v ? '알림을 켰어요' : '알림을 껐어요')} />} />
        <MenuRow label="광고성 정보 수신" right={
          <Toggle label="광고성 정보 수신" checked={ads} onChange={(v) => setConsent(v ? { marketing: true } : { marketing: false, nightMarketing: false }, v ? '광고성 정보 수신에 동의했어요' : '광고성 정보 수신을 철회했어요')} />} />
        <MenuRow label="야간(21시~08시) 광고성 정보 수신" right={
          <Toggle label="야간 광고성 정보 수신" checked={night} onChange={(v) => {
            if (v && !ads) return toast('광고성 정보 수신에 먼저 동의해 주세요')
            setConsent({ nightMarketing: v }, v ? '야간 수신에 동의했어요' : '야간 수신을 철회했어요')
          }} />} />
      </MenuGroup>

      <MenuGroup title="테마">
        <li className="px-5 py-2">
          <Segmented<Theme> label="테마" value={theme} onChange={setTheme}
            options={[{ value: 'system', label: '기기 설정' }, { value: 'light', label: '라이트' }, { value: 'dark', label: '다크' }]} />
        </li>
      </MenuGroup>

      <MenuGroup title="약관">
        <MenuRow label="동의 내역" to="/my/settings/consents" />
      </MenuGroup>
    </>
  )
}
