import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'
import { ArtistPicker } from '@/components/ArtistPicker'
import { Button } from '@/components/ui/Button'

// 첫 진입 관심 아티스트 지정 (기획서 5.1). 0명이어도 넘어갈 수 있다
export default function ArtistSetup() {
  const nav = useNavigate()
  const myArtists = useAppStore((s) => s.myArtists)
  const setArtists = useAppStore((s) => s.setArtists)
  const finishSetup = useAppStore((s) => s.finishSetup)
  const [sel, setSel] = useState(myArtists)

  const done = (ids: string[]) => {
    setArtists(ids)
    finishSetup()
    nav('/', { replace: true })
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex justify-end px-3 pt-2">
        <Button variant="plain" size="sm" onClick={() => done([])}>나중에 하기</Button>
      </div>
      <div className="flex-1">
        <div className="px-5 pb-5 pt-6">
          <h1 className="t-large">좋아하는 아티스트</h1>
          <p className="mt-3 t-body text-graphite">고른 아티스트의 공연을 캘린더에 먼저 보여 주고, 취향이 겹치는 사람을 추천해요.</p>
        </div>
        <ArtistPicker value={sel} onChange={setSel} />
      </div>
      <div className="sticky bottom-0 bg-paper/90 px-5 pb-6 pt-3 backdrop-blur-xl">
        <Button block disabled={sel.length === 0} onClick={() => done(sel)}>
          {sel.length ? `${sel.length}명으로 시작하기` : '아티스트를 골라 주세요'}
        </Button>
      </div>
    </div>
  )
}
