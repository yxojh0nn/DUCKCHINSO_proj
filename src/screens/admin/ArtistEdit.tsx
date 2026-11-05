import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorText, type AdminArtist } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { Button } from '@/components/ui/Button'
import { TextArea, TextField } from '@/components/ui/Field'
import { keys } from '@/lib/queries'
import { toast } from '@/store/ui'

// 아티스트 추가·수정. 별칭은 KOPIS 공연명·출연진과 맞춰 볼 이름 (예: 레갈릴리, Regal Lily). 저장하면 다음 수집부터 반영
export default function ArtistEdit() {
  const { id = 'new' } = useParams()
  const artist = useQuery({ queryKey: ['admin', 'artist', id], queryFn: () => api.adminGetArtist(id), enabled: id !== 'new' })
  if (id !== 'new' && !artist.data) return <AppHeader back title="아티스트" />
  return <ArtistForm artist={artist.data ?? null} />
}

function ArtistForm({ artist }: { artist: AdminArtist | null }) {
  const nav = useNavigate()
  const qc = useQueryClient()
  const [name, setName] = useState(artist?.name ?? '')
  const [nameJa, setNameJa] = useState(artist?.nameJa ?? '')
  const [nameEn, setNameEn] = useState(artist?.nameEn ?? '')
  const [aliases, setAliases] = useState((artist?.aliases ?? []).join('\n'))
  const [busy, setBusy] = useState(false)
  const ok = name.trim().length >= 1

  const save = async () => {
    if (!ok || busy) return
    setBusy(true)
    try {
      await api.adminSaveArtist({ id: artist?.id, name, nameJa, nameEn, aliases: aliases.split(/[\n,]/) })
      await Promise.all([qc.invalidateQueries({ queryKey: ['admin'] }), qc.invalidateQueries({ queryKey: keys.artists })])
      toast('저장했어요. 다음 수집부터 반영돼요')
      nav(-1)
    } catch (e) { toast(errorText(e)) } finally { setBusy(false) }
  }

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader back title={artist ? '아티스트 수정' : '새 아티스트'} />
      <div className="flex flex-1 flex-col gap-5 px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-2">
        <TextField label="한국어 이름 (화면에 보이는 이름)" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        <TextField label="일본어 이름" value={nameJa} onChange={(e) => setNameJa(e.target.value)} maxLength={60} />
        <TextField label="영문 이름" value={nameEn} onChange={(e) => setNameEn(e.target.value)} maxLength={60} />
        <TextArea label="별칭 (한 줄에 하나)" rows={5} value={aliases} onChange={(e) => setAliases(e.target.value)}
          placeholder={'예) 레갈릴리\nRegal Lily'} hint="KOPIS 공연명·출연진에 이 이름이 있으면 이 아티스트의 공연으로 봐요." />
        <Button block className="mt-auto" disabled={!ok || busy} onClick={save}>{busy ? '저장 중…' : '저장'}</Button>
      </div>
    </div>
  )
}
