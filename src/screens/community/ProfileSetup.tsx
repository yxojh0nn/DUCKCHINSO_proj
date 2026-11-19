import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { ImageButton } from '@/components/ImageButton'
import { PickList } from '@/components/PickList'
import { RegionField } from '@/components/RegionField'
import { IconPhoto } from '@/components/icons'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { TextArea, TextField } from '@/components/ui/Field'
import { nicknameError } from '@/lib/settings'
import { keys, useArtists, useGenres, useMe, useMembership } from '@/lib/queries'
import { useRun } from '@/lib/actions'

// 프로필 설정: 닉네임·사진·소개글 → 관심 아티스트 → 관심 장르
// 회원: 첫 로그인 때 메인 화면 전에 꼭 거친다 (Gate 가 보냄, 단계별로 건너뛸 수 있음) / 비회원: 커뮤니티 첫 진입 때
export default function ProfileSetup() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const me = useMe().data
  const { m } = useMembership()
  const artists = useArtists().data ?? []
  const genres = useGenres().data ?? []
  const [step, setStep] = useState(0)
  const [nickname, setNickname] = useState(me?.nickname ?? '')
  const [artistIds, setArtistIds] = useState<string[]>(me?.artistIds ?? [])
  const [genreIds, setGenreIds] = useState<number[]>(me?.genreIds ?? [])
  const [bio, setBio] = useState(me?.bio ?? '')
  const [region, setRegion] = useState(me?.region ?? '')
  const [regionPublic, setRegionPublic] = useState(me?.regionPublic ?? true)
  const [avatar, setAvatar] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const { busy, run } = useRun()
  const nickErr = nicknameError(nickname)
  const nickOk = !nickErr

  // 닉네임은 첫 단계에서 바로 저장한다 (중복·금칙어면 다음으로 넘어가지 않게)
  const saveNickname = async () => {
    if (!nickOk || busy || !me) return
    if (nickname.trim() === me.nickname) return setStep(1)
    return run(async () => {
      await api.updateMe({ nickname: nickname.trim() })
      setStep(1)
    })
  }

  const from = (useLocation().state as { from?: string } | null)?.from
  const finish = async () => {
    return run(async () => {
      await api.setMyArtists(artistIds)
      await api.setMyGenres(genreIds)
      const avatarUrl = avatar ? await api.uploadImage('avatar', avatar) : undefined
      await api.updateMe({ bio: bio.trim(), profileSetupDone: true, ...(me?.isGuest ? {} : { region: region || null, regionPublic }), ...(avatarUrl ? { avatarUrl } : {}) })
      await qc.invalidateQueries({ queryKey: keys.me })
      nav(from ?? '/community', { replace: true })
    })
  }

  const steps = [
    { title: '프로필을 만들어 주세요', desc: me?.isGuest ? '소개글은 다른 사람에게 보여요. 나중에 MY에서 바꿀 수 있어요.' : '닉네임과 사진, 소개글은 다른 사람에게 보여요. 나중에 MY에서 바꿀 수 있어요.' },
    { title: '좋아하는 아티스트', desc: `최대 ${m.maxArtists}명까지 고를 수 있어요.` + ' 비슷한 취향의 덕친을 추천해 드려요.' },
    { title: '좋아하는 장르', desc: 'J-pop 안에서 즐겨 듣는 장르를 골라 주세요.' },
  ]
  // 첫 단계에서 뒤로 가면 공연 캘린더로 (프로필 없이도 공연은 볼 수 있다)
  const back = step ? () => setStep(step - 1) : () => nav('/calendar', { replace: true })

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader back={back} title={`${step + 1} / 3`}
        right={step > 0 && step < 2 ? <button onClick={() => setStep(step + 1)} className="h-11 px-4 t-body text-graphite">건너뛰기</button> : undefined} />
      <div className="px-5 pt-2">
        <h1 className="t-title">{steps[step].title}</h1>
        <p className="mt-1.5 t-sub text-graphite">{steps[step].desc}</p>
      </div>
      <div className="mt-4 flex-1">
        {step === 0 && me && (
          <div className="px-5">
            {/* 비회원: 닉네임·사진 고정 (서버 guest_profile_lock 도 막는다) */}
            {me.isGuest ? <div className="mx-auto mt-2 w-fit"><Avatar url={me.avatarUrl} name={me.nickname} size={96} /></div> : (
            <ImageButton label="프로필 사진 고르기" onPick={([b]) => { setAvatar(b); setPreview(URL.createObjectURL(b)) }} className="relative mx-auto mt-2 block">
              <Avatar url={preview ?? me.avatarUrl} name={nickname || me.nickname} size={96} />
              <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-ink text-paper"><IconPhoto size={17} /></span>
            </ImageButton>)}
            <TextField className="mt-6" label="닉네임" value={nickname} maxLength={20} onChange={(e) => setNickname(e.target.value)} readOnly={me.isGuest}
              error={nickErr} hint={me.isGuest ? '비회원 닉네임은 자동으로 정해져요. 닉네임·사진은 회원으로 로그인하면 바꿀 수 있어요.' : '다른 사람에게 보이는 이름이에요.'} />
            <TextArea className="mt-6" label="소개글" placeholder="당신의 덕력을 뽐내보세요!" rows={3} maxLength={150} value={bio} onChange={(e) => setBio(e.target.value)}
              hint={`${bio.length}/150`} />
            {/* 처음 한 번 지역을 물어본다 (선택). 비회원은 덕친 추천 대상이 아니라 묻지 않는다 */}
            {!me.isGuest && <div className="mt-6"><RegionField region={region} onRegion={setRegion} isPublic={regionPublic} onPublic={setRegionPublic} /></div>}
          </div>
        )}
        {step === 1 && (
          <PickList label="선택" searchable max={m.maxArtists} value={artistIds} onChange={setArtistIds}
            items={artists.map((a) => ({ id: a.id, label: a.name, sub: [a.nameJa, a.nameEn].filter(Boolean).join(' · ') }))} />
        )}
        {step === 2 && (
          <PickList label="선택" max={m.maxGenres} value={genreIds} onChange={setGenreIds}
            items={genres.map((g) => ({ id: g.id, label: g.name }))} />
        )}
      </div>
      <div className="sticky bottom-0 bg-paper px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-4">
        {step === 0 ? <Button block disabled={!nickOk || busy} onClick={saveNickname}>{busy ? '저장 중…' : '다음'}</Button>
          : step === 1 ? <Button block onClick={() => setStep(2)}>다음</Button>
          : <Button block disabled={busy} onClick={finish}>{busy ? '저장 중…' : me?.isGuest ? '커뮤니티 시작하기' : '시작하기'}</Button>}
      </div>
    </div>
  )
}
