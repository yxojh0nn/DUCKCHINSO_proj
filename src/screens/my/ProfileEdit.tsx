import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { ImageButton } from '@/components/ImageButton'
import { IconPhoto } from '@/components/icons'
import { Avatar } from '@/components/ui/Avatar'
import { TextArea, TextField } from '@/components/ui/Field'
import { keys, useMe } from '@/lib/queries'
import { nicknameError } from '@/lib/settings'
import { toast } from '@/store/ui'
import { useRun } from '@/lib/actions'
import { RegionField } from '@/components/RegionField'

// 프로필 편집: 배너·프로필 사진, 닉네임, 소개글
export default function ProfileEdit() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const me = useMe().data
  const [nickname, setNickname] = useState(me?.nickname ?? '')
  const [bio, setBio] = useState(me?.bio ?? '')
  const [region, setRegion] = useState(me?.region ?? '')
  const [regionPublic, setRegionPublic] = useState(me?.regionPublic ?? true)
  const [avatar, setAvatar] = useState<Blob | null>(null)
  const [banner, setBanner] = useState<Blob | null>(null)
  const { busy, run } = useRun()
  if (!me) return null

  const nickErr = nicknameError(nickname)
  const nickOk = !nickErr
  const save = async () => {
    if (!nickOk || busy) return
    return run(async () => {
      const [avatarUrl, bannerUrl] = await Promise.all([
        avatar ? api.uploadImage('avatar', avatar) : undefined,
        banner ? api.uploadImage('banner', banner) : undefined,
      ])
      await api.updateMe({ nickname: nickname.trim(), bio: bio.trim(), region: region || null, regionPublic, ...(avatarUrl ? { avatarUrl } : {}), ...(bannerUrl ? { bannerUrl } : {}) })
      await qc.invalidateQueries({ queryKey: keys.me })
      toast('프로필을 저장했어요')
      nav(-1)
    })
  }
  const bannerSrc = banner ? URL.createObjectURL(banner) : me.bannerUrl

  return (
    <>
      <AppHeader back title="프로필 편집" right={
        <button onClick={save} disabled={!nickOk || busy} className="h-11 px-4 t-body font-semibold disabled:opacity-30">{busy ? '저장 중' : '저장'}</button>
      } />
      {/* 비회원: 닉네임·사진·배너 고정 (서버 guest_profile_lock 도 막는다) */}
      {me.isGuest ? (<>
        <div className="h-[120px] w-full bg-mist">{me.bannerUrl && <img src={me.bannerUrl} alt="" className="h-full w-full object-cover" />}</div>
        <div className="-mt-10 px-5"><div className="w-fit rounded-full ring-4 ring-paper"><Avatar url={me.avatarUrl} name={me.nickname} size={80} /></div></div>
      </>) : (<>
      <ImageButton label="배너 사진 바꾸기" onPick={([b]) => setBanner(b)} className="relative block h-[120px] w-full bg-mist">
        {bannerSrc && <img src={bannerSrc} alt="" className="h-full w-full object-cover" />}
        <span className="absolute bottom-2 right-3 flex h-8 items-center gap-1 rounded-full bg-ink/80 px-3 t-cap text-paper"><IconPhoto size={14} />배너</span>
      </ImageButton>
      <div className="-mt-10 px-5">
        <ImageButton label="프로필 사진 바꾸기" onPick={([b]) => setAvatar(b)} className="relative rounded-full ring-4 ring-paper">
          <Avatar url={avatar ? URL.createObjectURL(avatar) : me.avatarUrl} name={nickname || me.nickname} size={80} />
          <span className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-ink text-paper"><IconPhoto size={15} /></span>
        </ImageButton>
      </div>
      </>)}
      <div className="space-y-6 px-5 pb-10 pt-6">
        <TextField label="닉네임" value={nickname} maxLength={20} onChange={(e) => setNickname(e.target.value)} readOnly={me.isGuest}
          error={nickErr} hint={me.isGuest ? '비회원 닉네임은 자동으로 정해져요. 닉네임·사진은 회원으로 로그인하면 바꿀 수 있어요.' : undefined} />
        {!me.isGuest && <RegionField region={region} onRegion={setRegion} isPublic={regionPublic} onPublic={setRegionPublic} />}
        <TextArea label="소개글" placeholder="당신의 덕력을 뽐내보세요!" rows={4} maxLength={150} value={bio} onChange={(e) => setBio(e.target.value)} hint={`${bio.length}/150`} />
      </div>
    </>
  )
}
