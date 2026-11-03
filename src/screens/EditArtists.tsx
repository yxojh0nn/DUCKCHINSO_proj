import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'
import { AppHeader } from '@/components/AppHeader'
import { ArtistPicker } from '@/components/ArtistPicker'
import { Button } from '@/components/ui/Button'

export default function EditArtists() {
  const nav = useNavigate()
  const myArtists = useAppStore((s) => s.myArtists)
  const setArtists = useAppStore((s) => s.setArtists)
  const showToast = useAppStore((s) => s.showToast)
  const [sel, setSel] = useState(myArtists)
  const changed = sel.join() !== myArtists.join()

  return (
    <>
      <AppHeader
        title="관심 아티스트"
        back
        right={
          <Button variant="plain" size="sm" className="font-semibold" disabled={!changed} onClick={() => { setArtists(sel); showToast('저장했어요'); nav(-1) }}>
            저장
          </Button>
        }
      />
      <div className="flex-1 pb-10 pt-4">
        <ArtistPicker value={sel} onChange={setSel} />
      </div>
    </>
  )
}
