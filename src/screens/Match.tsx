import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ARTISTS, MOCK_USERS } from '@/data/mock'
import { APP_SETTINGS } from '@/lib/settings'
import { jaccard } from '@/lib/match'
import { remainText } from '@/lib/date'
import { isExpired, useAppStore } from '@/store/useAppStore'
import { AppHeader } from '@/components/AppHeader'
import { MatchCard } from '@/components/MatchCard'
import { Button } from '@/components/ui/Button'
import { Chip } from '@/components/ui/Chip'

type Tab = 'recommend' | 'received' | 'sent'

// 매칭: 추천·받은 요청·보낸 요청 (기획서 5.3)
export default function Match() {
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const artistFilter = params.get('artist')
  const [tab, setTab] = useState<Tab>('recommend')
  const s = useAppStore()
  const now = s.now()
  const sentToday = s.todaySentCount()
  const limit = APP_SETTINGS.dailyRequestLimit

  const blocked = new Set(s.blocks.map((b) => b.userId))
  const inRoom = new Set(s.rooms.map((r) => r.partnerId))
  const pendingWith = new Set(
    s.requests.filter((r) => r.status === 'pending' && !isExpired(r, now)).flatMap((r) => [r.from, r.to]),
  )
  const received = s.requests.filter((r) => r.to === 'me' && r.status === 'pending' && !isExpired(r, now))
  const sent = s.requests.filter((r) => r.from === 'me').sort((a, b) => b.createdAt - a.createdAt)

  const base = artistFilter ? [artistFilter] : s.myArtists
  const recs = MOCK_USERS
    .filter((u) => !blocked.has(u.id) && !inRoom.has(u.id) && !pendingWith.has(u.id))
    .map((u) => ({ u, score: jaccard(base, u.artistIds), overlap: u.artistIds.filter((a) => base.includes(a)) }))
    .filter((x) => x.overlap.length > 0)
    .sort((a, b) => b.score - a.score)

  const send = (userId: string) => {
    const r = s.sendRequest(userId)
    if (r === 'limit') s.showToast(`오늘 요청 ${limit}회를 모두 썼어요. 한국 시간 자정에 다시 채워져요`)
    else if (r === 'ok') s.showToast('대화를 요청했어요. 상대가 수락하면 채팅이 열려요')
  }

  const nick = (id: string) => MOCK_USERS.find((u) => u.id === id)?.nickname ?? '알 수 없음'

  return (
    <>
      <AppHeader title="취향 매칭" />
      <div className="sticky top-12 z-10 flex border-b border-line bg-surface">
        {([
          ['recommend', '추천'],
          ['received', `받은 요청${received.length ? ` ${received.length}` : ''}`],
          ['sent', '보낸 요청'],
        ] as const).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex-1 border-b-2 py-2.5 text-sm ${tab === k ? 'border-accent font-bold text-accent' : 'border-transparent text-muted'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 px-4 py-4">
        {tab === 'recommend' && (
          <>
            <div className="mb-3 flex items-center justify-between rounded-xl bg-chip px-3 py-2 text-xs">
              <span className="text-muted">오늘 남은 요청</span>
              <span className="font-bold">{Math.max(0, limit - sentToday)} / {limit}회</span>
            </div>
            {artistFilter && (
              <div className="mb-3 flex items-center gap-2">
                <Chip selected>{ARTISTS.find((a) => a.id === artistFilter)?.name} 팬만</Chip>
                <button className="text-xs text-muted underline" onClick={() => setParams({})}>필터 해제</button>
              </div>
            )}
            {base.length === 0 ? (
              <div className="py-10 text-center">
                <p className="mb-3 text-sm text-muted">관심 아티스트를 지정해야<br />취향이 겹치는 사람을 추천할 수 있어요</p>
                <Button onClick={() => nav('/me/artists')}>아티스트 지정하기</Button>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {recs.map(({ u, score, overlap }) => (
                  <MatchCard
                    key={u.id}
                    user={u}
                    score={score}
                    overlap={overlap}
                    action={<Button block disabled={sentToday >= limit} onClick={() => send(u.id)}>대화 요청</Button>}
                  />
                ))}
                {recs.length === 0 && <p className="py-10 text-center text-sm text-muted">지금은 추천할 사람이 없어요</p>}
              </div>
            )}
          </>
        )}

        {tab === 'received' && (
          <div className="flex flex-col gap-2.5">
            {received.map((r) => {
              const u = MOCK_USERS.find((x) => x.id === r.from)!
              return (
                <MatchCard
                  key={r.id}
                  user={u}
                  score={jaccard(s.myArtists, u.artistIds)}
                  overlap={u.artistIds.filter((a) => s.myArtists.includes(a))}
                  action={
                    <>
                      <p className="mb-2 text-xs text-muted">{remainText(r.expiresAt, now)} · 거절해도 상대에게 알리지 않아요</p>
                      <div className="flex gap-2">
                        <Button variant="secondary" className="flex-1" onClick={() => s.respond(r.id, false)}>거절</Button>
                        <Button className="flex-1" onClick={() => { s.respond(r.id, true); s.showToast('대화방이 열렸어요'); nav('/chats') }}>수락</Button>
                      </div>
                    </>
                  }
                />
              )
            })}
            {received.length === 0 && <p className="py-10 text-center text-sm text-muted">받은 요청이 없어요</p>}
          </div>
        )}

        {tab === 'sent' && (
          <ul className="flex flex-col gap-2">
            {sent.map((r) => {
              // 거절·만료는 상대 결정을 드러내지 않도록 같은 문구로 보여 준다
              const state = r.status === 'accepted' ? '수락됨' : r.status === 'pending' && !isExpired(r, now) ? remainText(r.expiresAt, now) : '종료됨'
              return (
                <li key={r.id} className="flex items-center justify-between rounded-xl border border-line bg-surface px-3.5 py-3 text-sm">
                  <span className="font-semibold">{nick(r.to)}</span>
                  <span className={r.status === 'accepted' ? 'text-good' : 'text-muted'}>{state}</span>
                </li>
              )
            })}
            {sent.length === 0 && <p className="py-10 text-center text-sm text-muted">보낸 요청이 없어요</p>}
          </ul>
        )}
      </div>
    </>
  )
}
