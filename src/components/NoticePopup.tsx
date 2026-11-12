import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Notice } from '@/api'
import { useNotices } from '@/lib/queries'
import { IconClose } from './icons'

const SEEN = 'notice-seen-at'
const seenAt = () => { try { return localStorage.getItem(SEEN) ?? '' } catch { return '' } }
const markSeen = (at: string) => { try { localStorage.setItem(SEEN, at) } catch { /* 저장 못 하면 다음 접속에 한 번 더 보일 뿐 */ } }

// 화면 위 공지 팝업: 이 기기에서 아직 못 본 최신 공지를 노출 기간(endsAt) 안에 한 번, 12초 동안. 접속 중이면 실시간(useLiveSync)으로 받아 바로 뜬다
// shortcut: 본 공지를 기기(localStorage)에 기억한다, 기기를 바꾸면 최신 공지가 한 번 더 뜬다 — 서버에 읽음 기록이 필요해지면 그때 옮긴다
export function NoticePopup() {
  const nav = useNavigate()
  // 운영자에게는 아직 안 열린 예약 공지도 내려오므로 공개 시각이 지난 것 중 최신
  const latest = useNotices().data?.find((n) => new Date(n.startsAt).getTime() <= Date.now())
  const [shown, setShown] = useState<Notice | null>(null)

  useEffect(() => {
    if (!latest || latest.startsAt <= seenAt() || (latest.endsAt && new Date(latest.endsAt).getTime() <= Date.now())) return
    markSeen(latest.startsAt)
    setShown(latest)
  }, [latest])

  useEffect(() => {
    if (!shown) return
    const t = setTimeout(() => setShown(null), 12_000)
    return () => clearTimeout(t)
  }, [shown])

  if (!shown) return null
  return (
    <div className="absolute inset-x-3 top-[max(10px,env(safe-area-inset-top))] z-50 mx-auto flex max-w-[536px] items-center rounded-[14px] border border-hairline bg-paper shadow-lg [animation:fade-in_160ms_ease-out]">
      <button onClick={() => { setShown(null); nav(`/community/notice/${shown.id}`) }} className="min-w-0 flex-1 px-4 py-3 text-left">
        <span className="t-cap font-semibold text-notice">공지</span>
        <p className="truncate t-body font-semibold">{shown.title}</p>
        <p className="truncate t-sub text-graphite">{shown.body}</p>
      </button>
      <button aria-label="공지 닫기" onClick={() => setShown(null)} className="flex h-11 w-11 shrink-0 items-center justify-center text-graphite"><IconClose size={18} /></button>
    </div>
  )
}
