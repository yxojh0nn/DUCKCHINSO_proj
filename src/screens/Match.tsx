import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ARTISTS, MOCK_USERS } from '@/data/mock'
import { APP_SETTINGS } from '@/lib/settings'
import { jaccard } from '@/lib/match'
import { remainText } from '@/lib/date'
import { isExpired, useAppStore } from '@/store/useAppStore'
import { AppHeader } from '@/components/AppHeader'
import { MatchRow } from '@/components/MatchCard'
import { Button } from '@/components/ui/Button'
import { Segmented } from '@/components/ui/Segmented'

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
  const left = Math.max(0, limit - sentToday)

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
    if (r === 'limit') s.showToast('오늘 보낼 수 있는 요청을 모두 썼어요')
    else if (r === 'ok') s.showToast('대화를 요청했어요')
  }

  const nick = (id: string) => MOCK_USERS.find((u) => u.id === id)?.nickname ?? '알 수 없음'

  return (
    <>
      <AppHeader title="매칭" large />
      <div className="px-5 pb-2 pt-2">
        <Segmented
          label="매칭 보기"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'recommend', label: '추천' },
            { value: 'received', label: received.length ? `받은 요청 ${received.length}` : '받은 요청' },
            { value: 'sent', label: '보낸 요청' },
          ]}
        />
      </div>

      <div className="flex-1 pb-8">
        {tab === 'recommend' && (
          <>
            <p className="px-5 pt-3 t-sub text-graphite num">
              오늘 {left}번 더 요청할 수 있어요. 한국 시간 자정에 {limit}번으로 다시 채워져요.
            </p>
            {artistFilter && (
              <div className="flex items-center justify-between px-5 pt-3">
                <p className="t-body">{ARTISTS.find((a) => a.id === artistFilter)?.name}를 좋아하는 사람</p>
                <Button variant="plain" size="sm" onClick={() => setParams({})}>모두 보기</Button>
              </div>
            )}
            {base.length === 0 ? (
              <div className="px-5 py-12">
                <p className="t-head">관심 아티스트를 먼저 골라 주세요</p>
                <p className="mt-1 t-body text-graphite">겹치는 아티스트가 많은 사람부터 추천해 드려요.</p>
                <Button className="mt-5" onClick={() => nav('/me/artists')}>아티스트 고르기</Button>
              </div>
            ) : (
              <ul className="mt-2">
                {recs.map(({ u, score, overlap }) => (
                  <MatchRow
                    key={u.id}
                    user={u}
                    score={score}
                    overlap={overlap}
                    action={<Button size="sm" disabled={left === 0} onClick={() => send(u.id)}>대화 요청</Button>}
                  />
                ))}
                {recs.length === 0 && <li className="px-5 py-12 t-body text-graphite">지금은 추천할 사람이 없어요. 내일 다시 확인해 보세요.</li>}
              </ul>
            )}
          </>
        )}

        {tab === 'received' && (
          <ul className="mt-2">
            {received.map((r) => {
              const u = MOCK_USERS.find((x) => x.id === r.from)!
              return (
                <MatchRow
                  key={r.id}
                  user={u}
                  score={jaccard(s.myArtists, u.artistIds)}
                  overlap={u.artistIds.filter((a) => s.myArtists.includes(a))}
                  note={`${remainText(r.expiresAt, now)}. 거절해도 상대에게 알리지 않아요.`}
                  action={
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => s.respond(r.id, false)}>거절</Button>
                      <Button size="sm" onClick={() => { s.respond(r.id, true); s.showToast('대화방을 열었어요'); nav('/chats') }}>수락</Button>
                    </div>
                  }
                />
              )
            })}
            {received.length === 0 && <li className="px-5 py-12 t-body text-graphite">받은 요청이 없어요.</li>}
          </ul>
        )}

        {tab === 'sent' && (
          <ul className="mt-2 border-y border-hairline/70">
            {sent.map((r) => {
              // 거절과 만료는 상대 결정을 드러내지 않도록 같은 문구로 보여 준다
              const state = r.status === 'accepted' ? '수락됨' : r.status === 'pending' && !isExpired(r, now) ? remainText(r.expiresAt, now) : '종료됨'
              return (
                <li key={r.id} className="group relative flex min-h-11 items-center justify-between px-5 py-3">
                  <span className="t-body">{nick(r.to)}</span>
                  <span className={`t-sub num ${r.status === 'accepted' ? 'text-success' : 'text-graphite'}`}>{state}</span>
                  <span aria-hidden className="absolute bottom-0 left-5 right-0 h-px bg-hairline/70 group-last:hidden" />
                </li>
              )
            })}
            {sent.length === 0 && <li className="px-5 py-12 t-body text-graphite">보낸 요청이 없어요.</li>}
          </ul>
        )}
      </div>
    </>
  )
}
