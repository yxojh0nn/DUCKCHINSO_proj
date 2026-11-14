import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorText, type Message } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { ImageButton } from '@/components/ImageButton'
import { ReportSheet } from '@/components/ReportSheet'
import { IconClose, IconPhoto, IconSend, IconSmile, IconWave } from '@/components/icons'
import { Avatar } from '@/components/ui/Avatar'
import { Confirm } from '@/components/ui/Confirm'
import { Sheet } from '@/components/ui/Sheet'
import { fmtDay, kstDayKey } from '@/lib/date'
import { openExternal } from '@/lib/external'
import { customerId, klipy, klipyOn, type KlipyGif } from '@/lib/klipy'
import { keys, useMe, useRooms } from '@/lib/queries'
import { toast } from '@/store/ui'
import { Bubble } from '@/components/chat/Bubble'
import { Viewer } from '@/components/chat/MediaViewer'
import { EmojiPicker, GifPicker } from '@/components/chat/Pickers'

const GREETING = '👋'
// 사진은 기기가 읽을 수 있는 형식이면 모두(앱이 JPEG 로 바꿔 올림), 영상은 서버가 받는 형식만
const MEDIA = 'image/*,video/mp4,video/webm,video/quicktime'
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']
const LINK_WARN_OFF = 'chat-link-warn-off' // 기기마다 따로: '다시 표시하지 않기'

const linkWarnOff = () => { try { return localStorage.getItem(LINK_WARN_OFF) === '1' } catch { return false } }

// 1:1 채팅방. 상단에 상대 프로필, 사진·영상·GIF·이모지 전송, 첫 대화엔 인사하기 버튼. 새 메시지는 실시간으로 들어온다
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
  const [picked, setPicked] = useState<Message | null>(null) // 메뉴를 연 메시지 (내 메시지, 또는 받은 GIF)
  const [gifReport, setGifReport] = useState<Message | null>(null)
  const cid = useQuery({ queryKey: ['klipy-cid', me?.id], queryFn: () => customerId(me!.id), enabled: klipyOn && !!me, staleTime: Infinity }).data
  const [editing, setEditing] = useState<Message | null>(null)
  const [viewing, setViewing] = useState<string | null>(null)
  const [panel, setPanel] = useState<'emoji' | 'gif' | null>(null)
  const [link, setLink] = useState<string | null>(null)
  const [skipWarn, setSkipWarn] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const touchY = useRef(0)

  const list = messages.data ?? []
  // 목록 안에서만 맨 아래로. scrollIntoView 는 바깥 화면까지 움직여서 들어올 때 한 번 더 튕겼다
  useLayoutEffect(() => { const el = scroller.current; if (el) el.scrollTop = el.scrollHeight }, [list.length])
  // 키보드가 올라오거나 내려가 목록 높이가 바뀌어도 '맨 아래에서 떨어진 거리'를 그대로 둔다(보던 최신 메시지가 입력 바 뒤로 숨지 않게).
  // 줄어든 만큼 더하고 늘어난 만큼 빼는 방식은, 맨 아래에선 더하기가 막혀 빼기만 남아 키보드를 여닫을 때마다 위로 밀렸다
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    let gap = 0
    let h = el.clientHeight
    // 높이가 바뀐 직후 브라우저가 스스로 보내는 scroll 은 거리 계산이 틀어지므로, 높이 변화를 처리하기 전엔 무시
    const onScroll = () => { if (el.clientHeight === h) gap = el.scrollHeight - el.scrollTop - el.clientHeight }
    const ro = new ResizeObserver(() => { h = el.clientHeight; el.scrollTop = el.scrollHeight - h - gap })
    el.addEventListener('scroll', onScroll, { passive: true })
    ro.observe(el)
    return () => { ro.disconnect(); el.removeEventListener('scroll', onScroll) }
  }, [])
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
    const m = editing
    setEditing(null)
    send(() => m ? api.editMessage(m.id, body) : api.sendText(id, body))
  }
  const sendMedia = (blobs: Blob[]) => {
    if (blobs.some((b) => b.type.startsWith('video/') && !VIDEO_TYPES.includes(b.type))) return toast('영상은 mp4·webm·mov 만 보낼 수 있어요.')
    send(async () => { for (const b of blobs) await api.sendImage(id, b) })
  }
  // KLIPY 주소를 그대로 보낸다 (받아서 다시 올리지 않는다). share 는 KLIPY 통계·최근 목록용이라 실패해도 보내기는 끝난 것
  const sendGif = (g: KlipyGif, q: string) => {
    setPanel(null)
    send(async () => {
      await api.sendGif(id, g.url, g.slug)
      if (cid) klipy.share(g.slug, cid, q).then(() => qc.invalidateQueries({ queryKey: ['klipy', 'recent'] }), () => {})
    })
  }
  const openLink = (u: string) => {
    if (linkWarnOff()) return openExternal(u)
    setSkipWarn(false)
    setLink(u)
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

      {/* 키보드가 올라온 채로 대화를 아래로 쓸어내리면 키보드를 내린다 */}
      {/* role=log: 새 메시지가 오면 화면낭독기가 읽어 준다 */}
      <div ref={scroller} role="log" aria-label="대화 내용" aria-live="polite" className="flex-1 space-y-2 overflow-y-auto px-4 pb-3 pt-2"
        onTouchStart={(e) => { touchY.current = e.touches[0].clientY }}
        onTouchMove={(e) => { if (e.touches[0].clientY - touchY.current > 24 && document.activeElement instanceof HTMLInputElement) document.activeElement.blur() }}>
        {list.map((m, i) => {
          const newDay = i === 0 || kstDayKey(list[i - 1].createdAt) !== kstDayKey(m.createdAt)
          return (
            <div key={m.id}>
              {newDay && <p className="my-3 text-center t-cap text-graphite">{fmtDay(m.createdAt)}</p>}
              <Bubble m={m} mine={!!me && m.senderId === me.id} onOpen={setViewing} onLink={openLink}
                onMenu={me && !m.deleted && m.kind !== 'system' && (m.senderId === me.id || (m.gifSlug && m.senderId)) ? () => setPicked(m) : undefined} />
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
        <>
          {panel === 'emoji' && !editing && <EmojiPicker onEmoji={(e) => setText((t) => t + e)} />}
          {panel === 'gif' && !editing && cid && <GifPicker cid={cid} busy={sending} onPick={sendGif} />}
          {editing && (
            <div className="flex items-center gap-2 border-t border-hairline bg-paper px-4 py-1.5 t-sub text-graphite">
              <span className="flex-1 truncate">메시지 수정 중</span>
              <button type="button" onClick={() => { setEditing(null); setText('') }} aria-label="수정 취소" className="flex h-8 w-8 items-center justify-center"><IconClose size={18} /></button>
            </div>
          )}
          {/* 입력칸 안 오른쪽에 사진·이모지·GIF. 이모지는 휴대폰 키보드에 있으니 마우스로 쓰는 웹에서만 */}
          <form onSubmit={submit} className="flex items-center gap-1 border-t border-hairline bg-paper px-2 py-2 pb-[max(8px,env(safe-area-inset-bottom))]">
            <div className="flex h-11 min-w-0 flex-1 items-center rounded-full bg-mist pl-4 pr-1">
              <input value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="메시지" aria-label="메시지" autoComplete="off" enterKeyHint="send"
                className="h-full min-w-0 flex-1 bg-transparent outline-none t-body" />
              {!editing && (
                <>
                  <ImageButton label="사진·영상 보내기" accept={MEDIA} multiple onPick={sendMedia}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-graphite hover:text-ink"><IconPhoto size={22} /></ImageButton>
                  {/* GIF 버튼은 KLIPY 앱 키가 있는 빌드에서만 */}
                  {([['emoji', '이모지', <IconSmile key="e" size={22} />], ...(klipyOn ? [['gif', 'GIF', <span key="g" className="rounded-[4px] border-[1.5px] border-current px-[3px] text-[10px] font-bold leading-[13px]">GIF</span>]] as const : [])] as const).map(([k, label, icon]) => (
                    <button key={k} type="button" onClick={() => setPanel((p) => (p === k ? null : k))} aria-label={label} aria-expanded={panel === k}
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:text-ink ${panel === k ? 'text-ink' : 'text-graphite'} ${k === 'emoji' ? '[@media(hover:none)]:hidden' : ''}`}>{icon}</button>
                  ))}
                </>
              )}
            </div>
            <button type="submit" aria-label={editing ? '수정 완료' : '보내기'} disabled={!text.trim()} className="px-1 disabled:opacity-30"><IconSend size={34} /></button>
          </form>
        </>
      )}

      {picked && me && picked.senderId !== me.id ? (
        <Sheet open onClose={() => setPicked(null)} actions={[
          { label: 'GIF 신고하기', danger: true, onClick: () => { setGifReport(picked); setPicked(null) } },
        ]} />
      ) : (
        <Sheet open={!!picked} onClose={() => setPicked(null)} message="삭제하면 상대 화면에도 '삭제된 메시지예요'로 바뀌어요." actions={[
          ...(picked?.kind === 'text' ? [{ label: '메시지 수정', onClick: () => { const m = picked; setPicked(null); setPanel(null); setEditing(m); setText(m.body) } }] : []),
          { label: '메시지 삭제', danger: true, onClick: () => { const m = picked; setPicked(null); if (m) send(() => api.deleteMessage(m.id)) } },
        ]} />
      )}
      {gifReport?.gifSlug && cid && (
        <ReportSheet open target={{ messageId: gifReport.id }} gif={{ slug: gifReport.gifSlug, customerId: cid }} onClose={() => setGifReport(null)} />
      )}
      <Confirm open={!!link} title="외부 링크로 이동할까요?" confirmLabel="이동"
        message="확인되지 않은 링크일 수 있어요. 로그인·결제 정보를 요구하면 입력하지 마세요."
        onClose={() => setLink(null)}
        onConfirm={() => {
          if (skipWarn) try { localStorage.setItem(LINK_WARN_OFF, '1') } catch { /* 저장 못 하면 다음에도 묻는다 */ }
          if (link) openExternal(link)
          setLink(null)
        }}>
        <p className="mt-2 break-all t-cap text-graphite">{link}</p>
        <label className="mt-3 flex items-center justify-center gap-2 t-sub">
          <input type="checkbox" checked={skipWarn} onChange={(e) => setSkipWarn(e.target.checked)} className="h-4 w-4 accent-[var(--ink)]" />
          이 메시지 다시 표시하지 않기
        </label>
      </Confirm>
      {viewing && <Viewer url={viewing} onClose={() => setViewing(null)} />}
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
