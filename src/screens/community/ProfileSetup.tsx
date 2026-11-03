import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api, errorText } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { ImageButton } from '@/components/ImageButton'
import { PickList } from '@/components/PickList'
import { IconPhoto } from '@/components/icons'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { TextArea } from '@/components/ui/Field'
import { APP_SETTINGS } from '@/lib/settings'
import { keys, useArtists, useGenres, useMe } from '@/lib/queries'
import { toast } from '@/store/ui'

// 커뮤니티 첫 진입: 관심 아티스트 → 관심 장르 → 사진·소개글 (모두 건너뛸 수 있음)
export default function ProfileSetup() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const me = useMe().data
  const artists = useArtists().data ?? []
  const genres = useGenres().data ?? []
  const [step, setStep] = useState(0)
  const [artistIds, setArtistIds] = useState<string[]>(me?.artistIds ?? [])
  const [genreIds, setGenreIds] = useState<number[]>(me?.genreIds ?? [])
  const [bio, setBio] = useState(me?.bio ?? '')
  const [avatar, setAvatar] = useState<Blob | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const finish = async () => {
    setBusy(true)
    try {
      await api.setMyArtists(artistIds)
      await api.setMyGenres(genreIds)
      const avatarUrl = avatar ? await api.uploadImage('avatar', avatar) : undefined
      await api.updateMe({ bio: bio.trim(), profileSetupDone: true, ...(avatarUrl ? { avatarUrl } : {}) })
      await qc.invalidateQueries({ queryKey: keys.me })
      nav('/community', { replace: true })
    } catch (e) { toast(errorText(e)) } finally { setBusy(false) }
  }

  const steps = [
    { title: '좋아하는 아티스트', desc: '최대 5명까지 고를 수 있어요. 비슷한 취향의 덕친을 추천해 드려요.' },
    { title: '좋아하는 장르', desc: 'J-pop 안에서 즐겨 듣는 장르를 골라 주세요.' },
    { title: '나를 소개해 주세요', desc: '사진과 소개글은 커뮤니티에서 다른 사람에게 보여요. 나중에 MY에서 바꿀 수 있어요.' },
  ]

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader back={() => (step ? setStep(step - 1) : nav('/calendar'))} title={`${step + 1} / 3`}
        right={step < 2 ? <button onClick={() => setStep(step + 1)} className="h-11 px-4 t-body text-graphite">건너뛰기</button> : undefined} />
      <div className="px-5 pt-2">
        <h1 className="t-title">{steps[step].title}</h1>
        <p className="mt-1.5 t-sub text-graphite">{steps[step].desc}</p>
      </div>
      <div className="mt-4 flex-1">
        {step === 0 && (
          <PickList label="선택" searchable max={APP_SETTINGS.maxArtists} value={artistIds} onChange={setArtistIds}
            items={artists.map((a) => ({ id: a.id, label: a.name, sub: [a.nameJa, a.nameEn].filter(Boolean).join(' · ') }))} />
        )}
        {step === 1 && (
          <PickList label="선택" max={APP_SETTINGS.maxGenres} value={genreIds} onChange={setGenreIds}
            items={genres.map((g) => ({ id: g.id, label: g.name }))} />
        )}
        {step === 2 && me && (
          <div className="px-5">
            <ImageButton label="프로필 사진 고르기" onPick={([b]) => { setAvatar(b); setPreview(URL.createObjectURL(b)) }} className="relative mx-auto mt-2 block">
              <Avatar url={preview ?? me.avatarUrl} name={me.nickname} size={96} />
              <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-ink text-paper"><IconPhoto size={17} /></span>
            </ImageButton>
            <p className="mt-3 text-center t-head">{me.nickname}</p>
            <TextArea className="mt-6" label="소개글" placeholder="당신의 덕력을 뽐내보세요!" rows={3} maxLength={150} value={bio} onChange={(e) => setBio(e.target.value)}
              hint={`${bio.length}/150`} />
          </div>
        )}
      </div>
      <div className="sticky bottom-0 bg-paper px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-4">
        {step < 2 ? <Button block onClick={() => setStep(step + 1)}>다음</Button>
          : <Button block disabled={busy} onClick={finish}>{busy ? '저장 중…' : '커뮤니티 시작하기'}</Button>}
      </div>
    </div>
  )
}
