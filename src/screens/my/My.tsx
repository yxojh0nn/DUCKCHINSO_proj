import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/api'
import { MenuGroup, MenuRow } from '@/components/MenuRow'
import { IconAdmin, IconFriends, IconGear, IconInfo, IconInquiry, IconLogout, IconWithdraw } from '@/components/icons'
import { Button } from '@/components/ui/Button'
import { Confirm } from '@/components/ui/Confirm'
import { keys, useArtists, useMe } from '@/lib/queries'
import { ProfileHead } from './ProfileHead'

// MY 탭: 프로필 + 설정·친구 관리·내 정보·문의·로그아웃·회원탈퇴
export default function My() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const me = useMe().data
  const artists = useArtists().data ?? []
  const [logout, setLogout] = useState(false)
  if (!me) return null

  return (
    <div className="pb-8">
      <ProfileHead profile={me} artistNames={me.artistIds.map((a) => artists.find((x) => x.id === a)?.name ?? '').filter(Boolean)}
        action={<Button size="sm" variant="secondary" onClick={() => nav('/my/info/profile')}>프로필 편집</Button>} />

      <MenuGroup>
        <MenuRow icon={<IconGear />} label="설정" to="/my/settings" />
        <MenuRow icon={<IconFriends />} label="친구 관리" to="/my/friends" />
        <MenuRow icon={<IconInfo />} label="내 정보" to="/my/info" />
        <MenuRow icon={<IconInquiry />} label="문의" to="/my/inquiry" />
      </MenuGroup>
      {me.isAdmin && (
        <MenuGroup>
          <MenuRow icon={<IconAdmin />} label="관리자" to="/admin" />
        </MenuGroup>
      )}
      <MenuGroup>
        <MenuRow icon={<IconLogout />} label="로그아웃" onClick={() => setLogout(true)} />
        {!me.isGuest && <MenuRow icon={<IconWithdraw />} label="회원탈퇴" to="/my/withdraw" danger />}
      </MenuGroup>

      <Confirm open={logout} title="정말 로그아웃 하시겠습니까?"
        message={me.isGuest ? '비회원은 로그아웃하면 지금까지의 기록이 모두 지워져요. 함께 쓰는 기기라면 다 쓴 뒤 꼭 로그아웃해 주세요.' : undefined}
        confirmLabel="로그아웃" danger={me.isGuest} onClose={() => setLogout(false)}
        onConfirm={async () => {
          // 비회원은 나가면 계정을 지운다 (다음에 들어오면 새 익명 닉네임). 지우기에 실패해도 로그아웃은 한다
          if (me.isGuest) await api.deleteAccount().catch(() => api.signOut())
          else await api.signOut()
          qc.setQueryData(keys.session, null)
          nav('/login', { replace: true })
        }} />
    </div>
  )
}
