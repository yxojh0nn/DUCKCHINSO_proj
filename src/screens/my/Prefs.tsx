import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api, errorText } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { PickList } from '@/components/PickList'
import { TextTabs } from '@/components/ui/TextTabs'
import { APP_SETTINGS } from '@/lib/settings'
import { keys, useArtists, useGenres, useMe } from '@/lib/queries'
import { toast } from '@/store/ui'

// 관심 아티스트·장르 수정
export default function Prefs() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const me = useMe().data
  const artists = useArtists().data ?? []
  const genres = useGenres().data ?? []
  const [tab, setTab] = useState<'artists' | 'genres'>('artists')
  const [artistIds, setArtistIds] = useState(me?.artistIds ?? [])
  const [genreIds, setGenreIds] = useState(me?.genreIds ?? [])
  const [busy, setBusy] = useState(false)

  const save = async () => {
    setBusy(true)
    try {
      await api.setMyArtists(artistIds)
      await api.setMyGenres(genreIds)
      await Promise.all([qc.invalidateQueries({ queryKey: keys.me }), qc.invalidateQueries({ queryKey: keys.recommend })])
      toast('저장했어요')
      nav(-1)
    } catch (e) { toast(errorText(e)) } finally { setBusy(false) }
  }
  return (
    <>
      <AppHeader back title="관심 아티스트·장르" right={
        <button onClick={save} disabled={busy} className="h-11 px-4 t-body font-semibold disabled:opacity-30">저장</button>
      } />
      <TextTabs label="종류" value={tab} onChange={setTab} tabs={[{ value: 'artists', label: '아티스트' }, { value: 'genres', label: '장르' }]} />
      <div className="pt-3">
        {tab === 'artists'
          ? <PickList label="선택" searchable max={APP_SETTINGS.maxArtists} value={artistIds} onChange={setArtistIds}
              items={artists.map((a) => ({ id: a.id, label: a.name, sub: [a.nameJa, a.nameEn].filter(Boolean).join(' · ') }))} />
          : <PickList label="선택" max={APP_SETTINGS.maxGenres} value={genreIds} onChange={setGenreIds} items={genres.map((g) => ({ id: g.id, label: g.name }))} />}
      </div>
    </>
  )
}
