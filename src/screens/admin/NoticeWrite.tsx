import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api, errorText } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { CheckMark } from '@/components/ui/Checkbox'
import { TextArea, TextField } from '@/components/ui/Field'
import { Segmented } from '@/components/ui/Segmented'
import { DAY_MS, fmtDateTime } from '@/lib/date'
import { keys } from '@/lib/queries'
import { toast } from '@/store/ui'

type Period = '1' | '3' | '7' | '30' | 'none'
const PERIODS: { value: Period; label: string }[] = [
  { value: '1', label: '1일' }, { value: '3', label: '3일' }, { value: '7', label: '7일' }, { value: '30', label: '30일' }, { value: 'none', label: '제한 없음' },
]

// <input type="datetime-local"> 값(기기 시간대 기준 "YYYY-MM-DDTHH:mm")
const localInput = (t: number) => {
  const d = new Date(t)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const nextHour = () => Math.ceil((Date.now() + 1) / 3_600_000) * 3_600_000

// 운영자 > 공지 올리기: 커뮤니티 공지 탭에 쌓이고, 모든 사용자 화면 위에 팝업으로 한 번 뜬다. 예약하면 그 시각에 열린다
export default function NoticeWrite() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [days, setDays] = useState<Period>('7')
  const [reserve, setReserve] = useState(false)
  const [at, setAt] = useState(() => localInput(nextHour()))
  const start = reserve ? new Date(at).getTime() : Date.now()
  const badStart = reserve && !(start > Date.now())
  const ok = !!title.trim() && !!body.trim() && !badStart
  const endsAt = days === 'none' ? null : new Date(start + Number(days) * DAY_MS).toISOString()

  const submit = async () => {
    if (!ok || busy) return
    setBusy(true)
    try {
      const id = await api.adminPostNotice(title, body, endsAt, reserve ? new Date(start).toISOString() : null)
      await qc.invalidateQueries({ queryKey: keys.notices })
      toast(reserve ? `${fmtDateTime(new Date(start).toISOString())}에 올라가요` : '공지를 올렸어요')
      nav(`/community/notice/${id}`, { replace: true })
    } catch (e) { toast(errorText(e)) } finally { setBusy(false) }
  }

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader back title="공지 올리기" right={
        <button onClick={submit} disabled={!ok || busy} className="h-11 px-4 t-body font-semibold disabled:opacity-30">{busy ? '올리는 중' : reserve ? '예약' : '올리기'}</button>
      } />
      <div className="flex-1 px-5 pb-8 pt-2">
        <p className="mb-5 t-sub text-graphite">회원·비회원 모두에게 화면 위 팝업으로 보이고, 커뮤니티 공지 탭에 남아요.</p>
        <TextField label="제목" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="제목" />
        <TextArea className="mt-6" label="내용" rows={10} maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)} placeholder="공지 내용" />

        <button aria-pressed={reserve} onClick={() => setReserve(!reserve)} className="mt-6 flex min-h-11 items-center gap-3 text-left t-body font-semibold">
          <CheckMark checked={reserve} />업로드 예약
        </button>
        {reserve && (
          <TextField className="mt-2" label="올라갈 날짜·시간" type="datetime-local" value={at} min={localInput(Date.now())}
            onChange={(e) => setAt(e.target.value)} error={badStart ? '지금 이후로 정해 주세요.' : undefined} />
        )}

        <p className="mb-2 mt-6 t-sub font-semibold">팝업 노출 기간</p>
        <Segmented label="팝업 노출 기간" value={days} onChange={setDays} options={PERIODS} />
        <p className="mt-2 t-sub text-graphite">
          {reserve && !badStart ? `${fmtDateTime(new Date(start).toISOString())}에 올라가고, ` : ''}
          {endsAt ? `${fmtDateTime(endsAt)}까지 처음 접속하는 사람에게 팝업으로 보여요.` : '기간 없이 아직 못 본 사람에게 팝업으로 보여요.'} 공지 탭에는 계속 남아요.
        </p>
      </div>
    </div>
  )
}
