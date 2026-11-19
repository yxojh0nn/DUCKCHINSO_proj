import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { PickList } from '@/components/PickList'
import { TextTabs } from '@/components/ui/TextTabs'
import { keys, useArtists, useGenres, useMe, useMembership } from '@/lib/queries'
import { toast } from '@/store/ui'
import { useRun } from '@/lib/actions'

// 관심 아티스트·장르 수정
export default function Prefs() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const me = useMe().data
  const { m } = useMembership()
  const artists = useArtists().data ?? []
  const genres = useGenres().data ?? []
  const [tab, setTab] = useState<'artists' | 'genres'>('artists')
  const [artistIds, setArtistIds] = useState(me?.artistIds ?? [])
  const [genreIds, setGenreIds] = useState(me?.genreIds ?? [])
  const { busy, run } = useRun()

  const save = async () => {
    return run(async () => {
      await api.setMyArtists(artistIds)
      await api.setMyGenres(genreIds)
      await Promise.all([qc.invalidateQueries({ queryKey: keys.me }), qc.invalidateQueries({ queryKey: keys.recommend })])
      toast('저장했어요')
      nav(-1)
    })
  }
  return (
    <>
      <AppHeader back title="관심 아티스트·장르" right={
        <button onClick={save} disabled={busy} className="h-11 px-4 t-body font-semibold disabled:opacity-30">저장</button>
      } />
      <TextTabs label="종류" value={tab} onChange={setTab} tabs={[{ value: 'artists', label: '아티스트' }, { value: 'genres', label: '장르' }]} />
      <div className="pt-3">
        {tab === 'artists'
          ? <PickList label="선택" searchable max={m.maxArtists} value={artistIds} onChange={setArtistIds}
              items={artists.map((a) => ({ id: a.id, label: a.name, sub: [a.nameJa, a.nameEn].filter(Boolean).join(' · ') }))} />
          : <PickList label="선택" max={m.maxGenres} value={genreIds} onChange={setGenreIds} items={genres.map((g) => ({ id: g.id, label: g.name }))} />}
      </div>
    </>
  )
}
