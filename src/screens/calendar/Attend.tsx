import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api, type Attendance, type Concert } from '@/api'
import { ImageButton } from '@/components/ImageButton'
import { IconClose, IconPhoto } from '@/components/icons'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { useRun } from '@/lib/actions'
import { kstDayKey } from '@/lib/date'
import { keys, useAttendance, useMe, useMembership } from '@/lib/queries'
import { toast } from '@/store/ui'

export const dayLabel = (d: string) => `${Number(d.slice(5, 7))}월 ${Number(d.slice(8))}일`
// 이미 열린 회차 날짜 (오늘 포함): 다녀왔다고 기록할 수 있는 날
export const pastDays = (c: Concert) => {
  const today = kstDayKey(Date.now())
  return [...new Set(c.schedules.map(kstDayKey))].filter((d) => d <= today).sort()
}

// 공연 상세: "이 공연 다녀오셨나요?" → 기록하면 덕질 캘린더에 남고, 후기 쓰기로 이어진다. 후기 사진 한 장은 멤버십 회원만
export function AttendCard({ concert }: { concert: Concert }) {
  const me = useMe().data
  const mine = (useAttendance().data ?? []).filter((a) => a.concertId === concert.id)
  const [edit, setEdit] = useState<Attendance | 'new' | null>(null)
  const days = pastDays(concert)
  if (!days.length || !me) return null
  if (me.isGuest) return <p className="mx-5 mt-6 t-sub text-graphite">다녀온 공연 기록은 회원만 남길 수 있어요.</p>
  return (
    <section className="mx-5 mt-6 rounded-[16px] bg-mist px-4 py-4">
      {mine.length === 0 ? (
        <>
          <p className="t-head">이 공연 다녀오셨나요?</p>
          <p className="mt-1 t-sub text-graphite">기록하면 덕질 캘린더에 남고, 월간 리캡에 담겨요.</p>
          <Button block size="md" className="mt-3" onClick={() => setEdit('new')}>다녀왔어요</Button>
        </>
      ) : (
        <>
          <p className="t-sub font-semibold text-graphite">다녀온 기록</p>
          <ul className="mt-2 space-y-3">
            {mine.map((a) => (
              <li key={a.day} className="flex items-center gap-3">
                {a.photoUrl
                  ? <img src={a.photoUrl} alt={`${dayLabel(a.day)} 후기 사진`} className="h-14 w-14 shrink-0 rounded-[10px] object-cover" />
                  : <span aria-hidden className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[10px] bg-paper text-graphite"><IconPhoto size={20} /></span>}
                <div className="min-w-0 flex-1">
                  <p className="t-body font-semibold num">{dayLabel(a.day)} 다녀왔어요</p>
                  {a.postId
                    ? <Link to={`/community/post/${a.postId}`} className="t-sub font-semibold underline underline-offset-4">내 후기 보기</Link>
                    : <Link to={`/community/write?concert=${concert.id}`} className="t-sub font-semibold underline underline-offset-4">후기 쓰기</Link>}
                </div>
                <Button size="sm" variant="secondary" onClick={() => setEdit(a)}>고치기</Button>
              </li>
            ))}
          </ul>
          {mine.length < days.length && (
            <button onClick={() => setEdit('new')} className="mt-3 h-9 t-sub font-semibold text-graphite underline underline-offset-4">다른 날도 다녀왔어요</button>
          )}
        </>
      )}
      {/* 새 기록: 아직 기록 안 한 날 중에서 고른다 / 고치기: 날짜는 그대로 (다른 날이면 지우고 새로 기록) */}
      <AttendSheet key={edit === 'new' ? 'new' : edit?.day ?? 'none'} concert={concert}
        days={edit && edit !== 'new' ? [edit.day] : days.filter((d) => !mine.some((a) => a.day === d))}
        record={edit === 'new' ? null : edit} open={!!edit} onClose={() => setEdit(null)} />
    </section>
  )
}

// 기록 넣기·고치기 시트: 날짜(회차가 여러 날이면), 후기 사진 한 장(멤버십 회원), 지우기
function AttendSheet({ concert, days, record, open, onClose }: { concert: Concert; days: string[]; record: Attendance | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient()
  const { member } = useMembership()
  const { busy, run } = useRun()
  const [day, setDay] = useState<string | null>(null)
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null | undefined>(undefined) // undefined = 손대지 않음
  const pick = day ?? record?.day ?? days[days.length - 1]
  const shown = photo === undefined ? record?.photoUrl ?? null : photo?.url ?? null
  const close = () => { setDay(null); setPhoto(undefined); onClose() }
  const refresh = () => qc.invalidateQueries({ queryKey: keys.attendance })
  const save = () => run(async () => {
    // 사진을 건드리지 않았으면 undefined 로 보내 있던 사진을 그대로 둔다
    await api.setAttendance({ concertId: concert.id, day: pick, photo: photo === undefined ? undefined : photo?.blob ?? null })
    await refresh()
    toast(record ? '기록을 고쳤어요' : '다녀온 공연으로 기록했어요. 덕질 캘린더에서 볼 수 있어요')
    close()
  })
  const remove = () => run(async () => {
    await api.removeAttendance(concert.id, record!.day)
    await refresh()
    toast('기록을 지웠어요')
    close()
  })
  return (
    <Sheet open={open} onClose={close} title={record ? '다녀온 기록 고치기' : '다녀온 공연 기록'}>
      <div className="px-5 pb-4 pt-1">
        <p className="text-center t-body font-semibold">{concert.title}</p>
        {days.length > 1 && (
          <div className="mt-4">
            <p className="t-sub font-semibold text-graphite">다녀온 날</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {days.map((d) => (
                <button key={d} onClick={() => setDay(d)} aria-pressed={d === pick}
                  className={`h-9 rounded-full px-3.5 t-sub font-semibold num ${d === pick ? 'bg-ink text-paper' : 'bg-mist text-ink'}`}>{dayLabel(d)}</button>
              ))}
            </div>
          </div>
        )}
        <div className="mt-4">
          <p className="t-sub font-semibold text-graphite">후기 사진 <span className="font-medium">· 멤버십 전용</span></p>
          {member ? (
            <div className="mt-2 flex items-center gap-3">
              {shown ? (
                <div className="relative h-20 w-20">
                  <img src={shown} alt="후기 사진" className="h-full w-full rounded-[12px] object-cover" />
                  <button aria-label="후기 사진 빼기" onClick={() => setPhoto(null)} className="absolute -right-3.5 -top-3.5 flex h-10 w-10 items-center justify-center">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-paper"><IconClose size={13} strokeWidth={2.4} /></span>
                  </button>
                </div>
              ) : (
                <ImageButton label="후기 사진 고르기" onPick={([b]) => b && setPhoto({ blob: b, url: URL.createObjectURL(b) })}
                  className="flex h-20 w-20 items-center justify-center rounded-[12px] bg-mist text-graphite"><IconPhoto /></ImageButton>
              )}
              <p className="flex-1 t-sub text-graphite">한 장을 고르면 덕질 캘린더 그날 칸에 보이고, 후기 글 첫 사진으로 이어져요.</p>
            </div>
          ) : (
            <p className="mt-2 rounded-[12px] bg-mist px-3 py-3 t-sub text-graphite">
              사진 기록은 멤버십 혜택이에요. <Link to="/membership" onClick={close} className="font-semibold text-ink underline underline-offset-4">멤버십 보기</Link>
            </p>
          )}
        </div>
        <Button block className="mt-5" disabled={busy} onClick={save}>{record ? '저장' : '기록하기'}</Button>
        {record && <Button block variant="danger" size="md" className="mt-1" disabled={busy} onClick={remove}>기록 지우기</Button>}
      </div>
    </Sheet>
  )
}
