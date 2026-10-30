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

  return (
    <>
      <AppHeader title="관심 아티스트" back />
      <div className="flex-1 px-4 py-4">
        <ArtistPicker value={sel} onChange={setSel} />
      </div>
      <div className="sticky bottom-0 border-t border-line bg-surface p-4">
        <Button block onClick={() => { setArtists(sel); showToast('저장했어요'); nav(-1) }}>저장</Button>
      </div>
    </>
  )
}
