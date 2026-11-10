import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorText, type Message } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { ImageButton } from '@/components/ImageButton'
import { ReportSheet } from '@/components/ReportSheet'
import { IconPhoto, IconSend, IconWave } from '@/components/icons'
import { Avatar } from '@/components/ui/Avatar'
import { Sheet } from '@/components/ui/Sheet'
import { fmtDay, fmtTime, kstDayKey } from '@/lib/date'
import { keys, useMe, useRooms } from '@/lib/queries'
import { toast } from '@/store/ui'

const GREETING = '안녕하세요! 반가워요 :) 같이 덕질해요'

function Bubble({ m, mine }: { m: Message; mine: boolean }) {
  if (m.kind === 'system') return <p className="mx-auto my-3 max-w-[80%] text-center t-cap text-graphite">{m.body}</p>
  return (
    <div className={`flex items-end gap-1.5 ${mine ? 'flex-row-reverse' : ''}`}>
      {m.kind === 'image' && m.imageUrl
        ? <img src={m.imageUrl} alt="보낸 사진" className="max-h-64 max-w-[65%] rounded-[16px] bg-mist object-cover" />
        : <p className={`max-w-[72%] whitespace-pre-wrap break-words rounded-[18px] px-3.5 py-2 t-body ${mine ? 'bg-ink text-paper' : 'bg-mist'}`}>{m.body}</p>}
      <span className="shrink-0 pb-0.5 text-[10px] text-graphite num">{fmtTime(m.createdAt)}</span>
    </div>
  )
}

// 1:1 채팅방. 상단에 상대 프로필, 사진 전송, 첫 대화엔 인사하기 버튼. 새 메시지는 실시간으로 들어온다
export default function ChatRoom() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const qc = useQueryClient()
  const me = useMe().data
  const room = useRooms().data?.find((r) => r.id === id)
  const messages = useQuery({ queryKey: keys.messages(id), queryFn: () => api.listMessages(id) })
  const [text, setText] = useState('')
  const [menu, setMenu] = useState(false)
  const [report, setReport] = useState(false)
  const [sending, setSending] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)

  const list = messages.data ?? []
  // 목록 안에서만 맨 아래로. scrollIntoView 는 바깥 화면까지 움직여서 들어올 때 한 번 더 튕겼다
  useLayoutEffect(() => { const el = scroller.current; if (el) el.scrollTop = el.scrollHeight }, [list.length])
  // 방에 들어와 있는 동안 받은 메시지는 읽음 처리
  useEffect(() => {
    if (!list.length) return
    api.markRead(id).then(() => qc.invalidateQueries({ queryKey: keys.rooms }))
  }, [id, list.length, qc])

  const send = async (f: () => Promise<void>) => {
    if (sending) return
    setSending(true)
    try {
      await f()
      await Promise.all([qc.invalidateQueries({ queryKey: keys.messages(id) }), qc.invalidateQueries({ queryKey: keys.rooms })])
    } catch (e) { toast(errorText(e)) } finally { setSending(false) }
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    setText('')
    send(() => api.sendText(id, body))
  }

  const partner = room?.partner
  const support = room?.kind === 'support'
  const talked = list.some((m) => m.kind !== 'system' && m.senderId)

  return (
    <div className="flex h-full flex-col">
      <AppHeader back title={partner && (
        <button onClick={() => !support && setMenu(true)} className="flex items-center gap-2" aria-label={support ? undefined : `${partner.nickname} 프로필 메뉴`}>
          {!support && <Avatar url={partner.avatarUrl} name={partner.nickname} size={28} />}
          <span className="max-w-[180px] truncate t-head">{partner.nickname}</span>
        </button>
      )} />

      <div ref={scroller} className="flex-1 space-y-2 overflow-y-auto px-4 pb-3 pt-2">
        {list.map((m, i) => {
          const newDay = i === 0 || kstDayKey(list[i - 1].createdAt) !== kstDayKey(m.createdAt)
          return (
            <div key={m.id}>
              {newDay && <p className="my-3 text-center t-cap text-graphite">{fmtDay(m.createdAt)}</p>}
              <Bubble m={m} mine={!!me && m.senderId === me.id} />
              {m.senderId === null && m.kind === 'text' && <p className="ml-1 mt-0.5 t-cap text-graphite">덕친소 운영팀</p>}
            </div>
          )
        })}
        {room && !talked && !support && room.canSend && (
          <div className="flex flex-col items-center pt-16 text-center">
            <p className="t-sub text-graphite">{partner?.nickname} 님과 친구가 됐어요</p>
            <button onClick={() => send(() => api.sendText(id, GREETING))} disabled={sending}
              className="mt-3 flex h-11 items-center gap-2 rounded-full bg-mist px-5 t-body font-semibold active:opacity-70">
              <IconWave size={20} />인사하기
            </button>
          </div>
        )}
      </div>

      {room && !room.canSend ? (
        <p className="border-t border-hairline px-5 py-4 pb-[max(16px,env(safe-area-inset-bottom))] text-center t-sub text-graphite">
          지금은 이 대화방에 메시지를 보낼 수 없어요.
        </p>
      ) : (
        <form onSubmit={submit} className="flex items-center gap-1.5 border-t border-hairline bg-paper px-2 py-2 pb-[max(8px,env(safe-area-inset-bottom))]">
          <ImageButton label="사진 보내기" onPick={([b]) => b && send(() => api.sendImage(id, b))}
            className="flex h-11 w-11 items-center justify-center text-graphite"><IconPhoto /></ImageButton>
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="메시지" aria-label="메시지"
            className="h-10 min-w-0 flex-1 rounded-full bg-mist px-4 outline-none t-body" />
          <button type="submit" aria-label="보내기" disabled={!text.trim()} className="px-1 disabled:opacity-30"><IconSend size={34} /></button>
        </form>
      )}

      {partner?.id && (
        <>
          <Sheet open={menu} onClose={() => setMenu(false)} title={partner.nickname} actions={[
            { label: '프로필 보기', onClick: () => nav(`/profile/${partner.id}`) },
            { label: '신고하기', danger: true, onClick: () => { setMenu(false); setReport(true) } },
          ]} />
          <ReportSheet open={report} target={{ userId: partner.id }} onClose={() => setReport(false)} />
        </>
      )}
    </div>
  )
}
