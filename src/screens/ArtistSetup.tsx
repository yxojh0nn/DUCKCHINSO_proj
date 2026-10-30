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
    <div className="flex min-h-full flex-col bg-surface">
      <div className="flex-1 overflow-y-auto px-5 pt-10">
        <p className="text-sm font-semibold text-accent">관심 아티스트</p>
        <h1 className="mb-1 mt-1 text-2xl font-bold leading-snug">좋아하는 아티스트를<br />골라 주세요</h1>
        <p className="mb-6 text-sm text-muted">캘린더에 먼저 보여 주고, 취향이 겹치는 사람을 추천할 때 써요. 내 정보에서 언제든 바꿀 수 있어요.</p>
        <ArtistPicker value={sel} onChange={setSel} />
      </div>
      <div className="flex gap-2 p-5">
        <Button variant="secondary" onClick={() => done([])}>나중에 하기</Button>
        <Button className="flex-1" disabled={sel.length === 0} onClick={() => done(sel)}>
          {sel.length ? `${sel.length}명 선택 완료` : '아티스트를 골라 주세요'}
        </Button>
      </div>
    </div>
  )
}
