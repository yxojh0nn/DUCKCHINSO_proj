import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorText, type Gif, type Message } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { ImageButton } from '@/components/ImageButton'
import { ReportSheet } from '@/components/ReportSheet'
import { IconClose, IconMore, IconPhoto, IconPlus, IconSend, IconSmile, IconWave } from '@/components/icons'
import { Avatar } from '@/components/ui/Avatar'
import { Confirm } from '@/components/ui/Confirm'
import { Sheet } from '@/components/ui/Sheet'
import { TextTabs } from '@/components/ui/TextTabs'
import { fmtDay, fmtTime, kstDayKey } from '@/lib/date'
import { openExternal } from '@/lib/external'
import { keys, useMe, useRooms } from '@/lib/queries'
import { toast } from '@/store/ui'

const GREETING = '👋'
// 사진은 기기가 읽을 수 있는 형식이면 모두(앱이 JPEG 로 바꿔 올림), 영상은 서버가 받는 형식만
const MEDIA = 'image/*,video/mp4,video/webm,video/quicktime'
const VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']
const EMOJIS = '😀 😂 🥹 😊 😍 🥰 😘 😎 🤩 🥳 😭 😢 😡 😱 🤔 🙄 😴 🤗 🙏 👍 👎 👏 🙌 💪 👋 🤞 ❤️ 🧡 💛 💚 💙 💜 🖤 💔 🔥 ✨ 🎉 🎶 🎤 🎸 🥁 🎧 📸 🍀 🌸 ⭐ 💯 👀'.split(' ')
// 끝의 마침표·괄호 등은 링크에서 뺀다
const URL_RE = /(https?:\/\/[^\s<>"]*[^\s<>".,!?)\]'])/g
const LINK_WARN_OFF = 'chat-link-warn-off' // 기기마다 따로: '다시 표시하지 않기'
const isVideo = (url: string) => /^data:video|\.(mp4|webm|mov)(\?|$)/i.test(url)

const linkWarnOff = () => { try { return localStorage.getItem(LINK_WARN_OFF) === '1' } catch { return false } }

// 받은 쪽과 같은 규칙: 말풍선 너비는 줄(row)의 72% 까지. (전에는 % 를 내 메시지를 감싼 버튼 기준으로 재서 내 말풍선만 세로로 길쭉했다)
// 내 메시지 메뉴(onMenu): 휴대폰은 길게 누르기, 웹은 마우스를 올리면 나오는 … 버튼
function Bubble({ m, mine, onMenu, onOpen, onLink }: {
  m: Message; mine: boolean; onMenu?: () => void; onOpen: (url: string) => void; onLink: (url: string) => void
}) {
  const timer = useRef(0)
  const held = useRef(false)
  if (m.kind === 'system') return <p className="mx-auto my-3 max-w-[80%] text-center t-cap text-graphite">{m.body}</p>

  const stop = () => window.clearTimeout(timer.current)
  const press = onMenu ? {
    onPointerDown: () => { held.current = false; timer.current = window.setTimeout(() => { held.current = true; onMenu() }, 500) },
    onPointerUp: stop, onPointerLeave: stop, onPointerCancel: stop,
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); onMenu() }, // 안드로이드 길게 누르기·웹 우클릭
    // 길게 눌러 메뉴를 연 뒤 손을 떼면서 사진·링크가 열리지 않게
    onClickCapture: (e: React.MouseEvent) => { if (held.current) { e.preventDefault(); e.stopPropagation(); held.current = false } },
  } : {}

  const url = m.imageUrl
  const content = m.deleted
    ? <p className="rounded-[18px] border border-hairline px-3.5 py-2 t-body text-graphite">{m.body}</p>
    : m.kind === 'image' && url
      ? (
        <button type="button" onClick={() => onOpen(url)} aria-label={isVideo(url) ? '영상 크게 보기' : '사진 크게 보기'} className="relative block overflow-hidden rounded-[16px] bg-mist">
          {isVideo(url)
            ? <><video src={url} muted playsInline preload="metadata" className="block max-h-64 max-w-full object-cover" />
              <span aria-hidden className="absolute inset-0 m-auto flex h-11 w-11 items-center justify-center rounded-full bg-black/50 pl-0.5 text-[18px] text-white">▶</span></>
            : <img src={url} alt="보낸 사진" className="block max-h-64 max-w-full object-cover" />}
        </button>
      )
      : (
        <p className={`whitespace-pre-wrap break-words rounded-[18px] px-3.5 py-2 t-body [overflow-wrap:anywhere] ${mine ? 'bg-ink text-paper' : 'bg-mist'}`}>
          {m.body.split(URL_RE).map((part, i) => i % 2
            ? <a key={i} href={part} onClick={(e) => { e.preventDefault(); onLink(part) }} className="underline underline-offset-2">{part}</a>
            : part)}
        </p>
      )

  return (
    <div className={`group flex items-end gap-1.5 ${mine ? 'flex-row-reverse' : ''}`}>
      <div className="min-w-0 max-w-[72%] [-webkit-touch-callout:none] [@media(hover:none)]:select-none" {...press}>{content}</div>
      {onMenu && (
        <button type="button" onClick={onMenu} aria-label="메시지 메뉴"
          className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-graphite opacity-0 hover:bg-mist focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:hidden">
          <IconMore size={18} />
        </button>
      )}
      <span className={`flex shrink-0 flex-col pb-0.5 text-[10px] text-graphite num ${mine ? 'items-end' : 'items-start'}`}>
        {m.edited && !m.deleted && <span>수정됨</span>}
        {fmtTime(m.createdAt)}
      </span>
    </div>
  )
}

type View = { s: number; x: number; y: number }
const MAX_ZOOM = 2
// 배율은 원본(화면에 맞춘 크기) 1 ~ 2배. 이동은 사진 가장자리가 원래 자리 안쪽으로 들어오지 않을 만큼만
const clampView = (s: number, x: number, y: number, w: number, h: number): View => {
  s = Math.min(MAX_ZOOM, Math.max(1, s))
  const mx = (w * (s - 1)) / 2, my = (h * (s - 1)) / 2
  return { s, x: Math.min(mx, Math.max(-mx, x)), y: Math.min(my, Math.max(-my, y)) }
}
// (px, py) 지점(가운데 기준)을 붙잡은 채로 배율 s 로
const zoomAt = (v: View, s: number, px: number, py: number, w: number, h: number) => {
  const k = Math.min(MAX_ZOOM, Math.max(1, s)) / v.s
  return clampView(v.s * k, px - (px - v.x) * k, py - (py - v.y) * k, w, h)
}

// 사진·영상 크게 보기. 사진 확대: 웹은 휠(최대 200%, 반대로 굴리면 원본까지)·더블클릭 150%, 휴대폰은 두 손가락. 확대 중엔 끌어서 이동
function Viewer({ url, onClose }: { url: string; onClose: () => void }) {
  const [v, setV] = useState<View>({ s: 1, x: 0, y: 0 })
  const box = useRef<HTMLDivElement>(null)
  const img = useRef<HTMLImageElement>(null)
  const pts = useRef(new Map<number, { x: number; y: number }>())
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // 가운데 기준 좌표와 사진의 (확대 전) 크기
  const geo = (cx: number, cy: number) => {
    const r = box.current!.getBoundingClientRect()
    return { px: cx - r.left - r.width / 2, py: cy - r.top - r.height / 2, w: img.current?.offsetWidth ?? 0, h: img.current?.offsetHeight ?? 0 }
  }

  useEffect(() => {
    const el = box.current
    if (!el || isVideo(url)) return
    // React 의 onWheel 은 passive 라 기본 스크롤을 막을 수 없어 직접 단다
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const { px, py, w, h } = geo(e.clientX, e.clientY)
      setV((v) => zoomAt(v, v.s * Math.exp(-e.deltaY * 0.002), px, py, w, h))
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [url])

  const onDown = (e: React.PointerEvent) => {
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    e.currentTarget.setPointerCapture(e.pointerId)
  }
  const onMove = (e: React.PointerEvent) => {
    const prev = pts.current.get(e.pointerId)
    if (!prev) return
    const before = [...pts.current.values()]
    pts.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const after = [...pts.current.values()]
    if (after.length >= 2) {
      // 두 손가락: 손가락 사이 거리 비율만큼 배율, 가운데 점 이동만큼 이동
      const [a0, b0] = before, [a1, b1] = after
      const d0 = Math.hypot(a0.x - b0.x, a0.y - b0.y), d1 = Math.hypot(a1.x - b1.x, a1.y - b1.y)
      const m = geo((a1.x + b1.x) / 2, (a1.y + b1.y) / 2)
      const dx = (a1.x + b1.x - a0.x - b0.x) / 2, dy = (a1.y + b1.y - a0.y - b0.y) / 2
      setV((v) => {
        const z = zoomAt(v, d0 ? (v.s * d1) / d0 : v.s, m.px, m.py, m.w, m.h)
        return clampView(z.s, z.x + dx, z.y + dy, m.w, m.h)
      })
    } else {
      const { w, h } = geo(0, 0)
      setV((v) => (v.s > 1 ? clampView(v.s, v.x + e.clientX - prev.x, v.y + e.clientY - prev.y, w, h) : v))
    }
  }
  const onUp = (e: React.PointerEvent) => { pts.current.delete(e.pointerId) }
  const onDouble = (e: React.MouseEvent) => {
    const { px, py, w, h } = geo(e.clientX, e.clientY)
    setV((v) => (v.s === 1 ? zoomAt(v, 1.5, px, py, w, h) : { s: 1, x: 0, y: 0 })) // 확대 중이면 원본으로
  }

  return (
    <div role="dialog" aria-modal="true" aria-label="크게 보기" className="absolute inset-0 z-50 flex bg-black [animation:fade-in_140ms_ease-out]">
      <div ref={box} className="flex flex-1 overflow-hidden"
        {...(isVideo(url) ? {} : { onPointerDown: onDown, onPointerMove: onMove, onPointerUp: onUp, onPointerCancel: onUp, onDoubleClick: onDouble, style: { touchAction: 'none' } })}>
        {isVideo(url)
          ? <video src={url} controls autoPlay playsInline className="m-auto max-h-full max-w-full" />
          : <img ref={img} src={url} alt="크게 본 사진" draggable={false}
            style={{ transform: `translate(${v.x}px, ${v.y}px) scale(${v.s})` }}
            className={`m-auto max-h-full max-w-full select-none object-contain ${v.s > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'}`} />}
      </div>
      <button onClick={onClose} aria-label="닫기" autoFocus
        className="absolute right-2 top-[max(8px,env(safe-area-inset-top))] flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white">
        <IconClose />
      </button>
    </div>
  )
}

// 이모지(입력칸에 넣기) · 공용 GIF(눌러서 바로 보내기, 직접 올리기는 운영자 검토 후 공개)
function Picker({ onEmoji, onGif, busy }: { onEmoji: (e: string) => void; onGif: (g: Gif) => void; busy: boolean }) {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'emoji' | 'gif'>('emoji')
  const gifs = useQuery({ queryKey: ['gifs'], queryFn: () => api.listGifs(), enabled: tab === 'gif' })
  const shown = (gifs.data ?? []).filter((g) => g.status === 'approved' || (g.mine && g.status === 'pending'))
  const upload = async (b: Blob) => {
    if (b.type !== 'image/gif') return toast('GIF 파일만 올릴 수 있어요.')
    if (b.size > 5 * 1024 * 1024) return toast('5MB보다 큰 GIF 는 올릴 수 없어요.')
    try {
      await api.uploadGif(b)
      await qc.invalidateQueries({ queryKey: ['gifs'] })
      toast('올렸어요. 검토가 끝나면 모두가 쓸 수 있어요.')
    } catch (e) { toast(errorText(e)) }
  }
  return (
    <div className="border-t border-hairline bg-paper">
      <TextTabs label="이모지·GIF" value={tab} onChange={setTab} tabs={[{ value: 'emoji', label: '이모지' }, { value: 'gif', label: 'GIF' }]} />
      <div className="h-56 overflow-y-auto px-3 pb-3">
        {tab === 'emoji' ? (
          <div className="grid grid-cols-8 gap-1">
            {EMOJIS.map((e) => (
              <button key={e} type="button" onClick={() => onEmoji(e)} aria-label={e} className="h-10 rounded-lg text-[24px] hover:bg-mist active:bg-mist">{e}</button>
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-1.5 md:grid-cols-4">
              <ImageButton accept="image/gif" label="GIF 올리기" onPick={([b]) => b && upload(b)}
                className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-hairline t-cap text-graphite active:bg-mist">
                <IconPlus />GIF 올리기
              </ImageButton>
              {shown.map((g) => (
                <button key={g.id} type="button" disabled={busy || g.status !== 'approved'} onClick={() => onGif(g)} aria-label="GIF 보내기"
                  className="relative aspect-square overflow-hidden rounded-lg bg-mist active:opacity-70">
                  <img src={g.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                  {g.status === 'pending' && <span className="absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-center text-[11px] text-white">검토 중</span>}
                </button>
              ))}
            </div>
            <p className="mt-2 t-cap text-graphite">올린 GIF 는 관리자 검토 후 모두에게 공개돼요. 선정적이거나 불쾌한 이미지는 공개되지 않아요.</p>
          </>
        )}
      </div>
    </div>
  )
}

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
  const [picked, setPicked] = useState<Message | null>(null) // 메뉴를 연 내 메시지
  const [editing, setEditing] = useState<Message | null>(null)
  const [viewing, setViewing] = useState<string | null>(null)
  const [panel, setPanel] = useState(false)
  const [link, setLink] = useState<string | null>(null)
  const [skipWarn, setSkipWarn] = useState(false)
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
    const m = editing
    setEditing(null)
    send(() => m ? api.editMessage(m.id, body) : api.sendText(id, body))
  }
  const sendMedia = (blobs: Blob[]) => {
    if (blobs.some((b) => b.type.startsWith('video/') && !VIDEO_TYPES.includes(b.type))) return toast('영상은 mp4·webm·mov 만 보낼 수 있어요.')
    send(async () => { for (const b of blobs) await api.sendImage(id, b) })
  }
  const sendGif = (g: Gif) => {
    setPanel(false)
    send(async () => api.sendImage(id, await (await fetch(g.url)).blob()))
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

      <div ref={scroller} className="flex-1 space-y-2 overflow-y-auto px-4 pb-3 pt-2">
        {list.map((m, i) => {
          const newDay = i === 0 || kstDayKey(list[i - 1].createdAt) !== kstDayKey(m.createdAt)
          return (
            <div key={m.id}>
              {newDay && <p className="my-3 text-center t-cap text-graphite">{fmtDay(m.createdAt)}</p>}
              <Bubble m={m} mine={!!me && m.senderId === me.id} onOpen={setViewing} onLink={openLink}
                onMenu={me && m.senderId === me.id && !m.deleted && m.kind !== 'system' ? () => setPicked(m) : undefined} />
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
          {panel && !editing && (
            <Picker busy={sending} onEmoji={(e) => setText((t) => t + e)} onGif={sendGif} />
          )}
          {editing && (
            <div className="flex items-center gap-2 border-t border-hairline bg-paper px-4 py-1.5 t-sub text-graphite">
              <span className="flex-1 truncate">메시지 수정 중</span>
              <button type="button" onClick={() => { setEditing(null); setText('') }} aria-label="수정 취소" className="flex h-8 w-8 items-center justify-center"><IconClose size={18} /></button>
            </div>
          )}
          <form onSubmit={submit} className="flex items-center gap-0.5 border-t border-hairline bg-paper px-2 py-2 pb-[max(8px,env(safe-area-inset-bottom))]">
            {!editing && (
              <>
                <ImageButton label="사진·영상 보내기" accept={MEDIA} multiple onPick={sendMedia}
                  className="flex h-11 w-10 items-center justify-center text-graphite"><IconPhoto /></ImageButton>
                <button type="button" onClick={() => setPanel((p) => !p)} aria-label="이모지·GIF" aria-expanded={panel}
                  className={`flex h-11 w-10 items-center justify-center ${panel ? 'text-ink' : 'text-graphite'}`}><IconSmile /></button>
              </>
            )}
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="메시지" aria-label="메시지"
              className="ml-1 h-10 min-w-0 flex-1 rounded-full bg-mist px-4 outline-none t-body" />
            <button type="submit" aria-label={editing ? '수정 완료' : '보내기'} disabled={!text.trim()} className="px-1 disabled:opacity-30"><IconSend size={34} /></button>
          </form>
        </>
      )}

      <Sheet open={!!picked} onClose={() => setPicked(null)} message="삭제하면 상대 화면에도 '삭제된 메시지예요'로 바뀌어요." actions={[
        ...(picked?.kind === 'text' ? [{ label: '메시지 수정', onClick: () => { const m = picked; setPicked(null); setPanel(false); setEditing(m); setText(m.body) } }] : []),
        { label: '메시지 삭제', danger: true, onClick: () => { const m = picked; setPicked(null); if (m) send(() => api.deleteMessage(m.id)) } },
      ]} />
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
