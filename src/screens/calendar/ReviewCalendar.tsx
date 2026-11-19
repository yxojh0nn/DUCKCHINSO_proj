import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api, DAILY_PHOTO_MAX, type Attendance, type Concert, type DailyPhoto } from '@/api'
import { ImageButton } from '@/components/ImageButton'
import { Poster } from '@/components/Poster'
import { IconClose } from '@/components/icons'
import { Viewer } from '@/components/chat/MediaViewer'
import { Confirm } from '@/components/ui/Confirm'
import { Empty } from '@/components/ui/Empty'
import { useRun } from '@/lib/actions'
import { monthGrid } from '@/lib/calendar'
import { keys, useMembership } from '@/lib/queries'
import { toast } from '@/store/ui'
import { dayLabel } from './Attend'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']
type Rec = Attendance & { concert: Concert | undefined }

// 덕질 캘린더: 그날의 첫 사진(없으면 다녀온 공연의 후기 사진, 그것도 없으면 포스터)을 칸에 작게 깐다. 공연 캘린더와 같은 격자·날짜 버튼
export function ReviewMonth({ year, month, records, photos, selected, today, onSelect }: {
  year: number; month: number; records: Rec[]; photos: Map<string, DailyPhoto[]>; selected: string | null; today: string; onSelect: (day: string) => void
}) {
  const weeks = useMemo(() => monthGrid(year, month), [year, month])
  const byDay = useMemo(() => {
    const m = new Map<string, Rec[]>()
    records.forEach((r) => m.set(r.day, [...(m.get(r.day) ?? []), r]))
    return m
  }, [records])
  return (
    <div role="grid" aria-label={`${year}년 ${month}월 후기`}>
      <div role="row" className="grid grid-cols-7 pb-1.5">
        {WEEK.map((w) => <span key={w} role="columnheader" className="text-center t-cap text-graphite">{w}</span>)}
      </div>
      {weeks.map((week, wi) => (
        <div role="row" key={wi} className="grid grid-cols-7">
          {week.map((day, di) => {
            if (!day) return <span key={di} role="gridcell" />
            const recs = byDay.get(day) ?? []
            const top = recs[0]
            const shots = photos.get(day) ?? []
            const shot = shots[0]?.photoUrl ?? top?.photoUrl ?? null
            const isSel = day === selected
            const label = `${dayLabel(day)}${recs.length ? `, 다녀온 공연 ${recs.length}개` : ''}${shots.length ? `, 사진 ${shots.length}장` : ''}${day === today ? ', 오늘' : ''}`
            return (
              <button key={day} role="gridcell" aria-selected={isSel} aria-label={label} onClick={() => onSelect(day)}
                className="flex min-h-[64px] flex-col items-center pb-1 pt-0.5 active:opacity-60">
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[14px] num ${isSel ? 'bg-ink font-semibold text-paper' : day === today ? 'font-bold' : ''}`}>
                  {Number(day.slice(8))}
                </span>
                {(top || shot) && (
                  <span aria-hidden className="relative mt-0.5">
                    {shot
                      ? <img src={shot} alt="" className="h-8 w-8 rounded-[7px] object-cover" />
                      : top?.concert ? <Poster id={top.concert.id} url={top.concert.posterUrl} title="" className="h-8 w-8 rounded-[7px]" />
                        : <span className="block h-8 w-8 rounded-[7px] bg-mist" />}
                    {(recs.length > 1 || shots.length > 1) && <span className="absolute -right-1.5 -top-1 rounded-full bg-ink px-1 text-[9px] font-bold leading-[13px] text-paper">{Math.max(recs.length, shots.length)}</span>}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

// 고른 날의 덕질 사진들: 모아 보기(누르면 크게)·더 담기·지우기 (멤버십 회원). 오늘과 지난 날만
export function DailyPhotoBlock({ day, photos }: { day: string; photos: DailyPhoto[] }) {
  const qc = useQueryClient()
  const { member } = useMembership()
  const { busy, run } = useRun()
  const [viewing, setViewing] = useState<string | null>(null)
  const [removing, setRemoving] = useState<DailyPhoto | null>(null)
  const left = DAILY_PHOTO_MAX - photos.length
  const add = (b: Blob[]) => run(async () => {
    if (b.length > left) throw new Error('too_many_photos')
    await api.addDailyPhotos(day, b)
    await qc.invalidateQueries({ queryKey: keys.dailyPhotos })
    toast(`${dayLabel(day)}에 사진 ${b.length}장을 담았어요`)
  })
  const remove = (p: DailyPhoto) => run(async () => {
    await api.removeDailyPhoto(p.id)
    await qc.invalidateQueries({ queryKey: keys.dailyPhotos })
    toast('사진을 지웠어요')
  })
  return (
    <div className="mx-5 mt-3 rounded-[14px] bg-mist p-3">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 t-body font-semibold">{dayLabel(day)}의 덕질 사진{photos.length > 0 && <span className="num text-graphite"> {photos.length}</span>}</p>
        {member && left > 0 && (
          <ImageButton multiple label="사진 담기" onPick={(b) => b.length && add(b)}
            className="h-9 shrink-0 rounded-full bg-ink px-3.5 t-sub font-semibold text-paper disabled:opacity-40">{busy ? '담는 중…' : '사진 담기'}</ImageButton>
        )}
      </div>
      {!member ? (
        <p className="mt-1 t-sub text-graphite">날마다 사진 기록은 멤버십 혜택이에요. <Link to="/membership" className="font-semibold text-ink underline underline-offset-4">멤버십 보기</Link></p>
      ) : !photos.length ? (
        <p className="mt-1 t-sub text-graphite">하루에 {DAILY_PHOTO_MAX}장까지 담을 수 있어요. 나만 볼 수 있어요.</p>
      ) : null}
      {photos.length > 0 && (
        <ul className="-mx-3 mt-2.5 flex gap-2 overflow-x-auto px-3 pb-0.5">
          {photos.map((p, i) => (
            <li key={p.id} className="relative shrink-0">
              <button aria-label={`${dayLabel(day)} 사진 ${i + 1} 크게 보기`} onClick={() => setViewing(p.photoUrl)} className="block active:opacity-70">
                <img src={p.photoUrl} alt="" loading="lazy" className="h-20 w-20 rounded-[10px] object-cover" />
              </button>
              <button aria-label={`사진 ${i + 1} 지우기`} disabled={busy} onClick={() => setRemoving(p)}
                className="absolute right-0.5 top-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white"><IconClose size={14} /></button>
            </li>
          ))}
        </ul>
      )}
      {viewing && <Viewer url={viewing} onClose={() => setViewing(null)} />}
      <Confirm open={!!removing} danger title="이 사진을 지울까요?" message="지운 사진은 되돌릴 수 없어요." confirmLabel="지우기"
        onClose={() => setRemoving(null)} onConfirm={() => { if (removing) remove(removing); setRemoving(null) }} />
    </div>
  )
}

// 덕질 캘린더 아래 목록: 다녀온 공연 한 줄 = 사진(또는 포스터) · 공연 · 날짜 · 후기 보기/쓰기
export function ReviewList({ records, title }: { records: Rec[]; title: string }) {
  return (
    <>
      <h3 className="px-5 pb-1 pt-3 t-sub font-semibold text-graphite">{title}</h3>
      {records.length ? (
        <ul>
          {records.map((r) => (
            <li key={`${r.concertId}-${r.day}`} className="flex items-center gap-3.5 px-5 py-3">
              <Link to={`/concert/${r.concertId}`} className="flex min-w-0 flex-1 items-center gap-3.5 active:opacity-60">
                {r.photoUrl
                  ? <img src={r.photoUrl} alt="후기 사진" className="h-[76px] w-[56px] shrink-0 rounded-[8px] object-cover" />
                  : <Poster id={r.concertId} url={r.concert?.posterUrl ?? null} title={r.concert?.title ?? ''} className="h-[76px] w-[56px] shrink-0 rounded-[8px]" />}
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 t-body font-semibold">{r.concert?.title ?? '정리된 공연'}</p>
                  <p className="mt-1 t-sub text-graphite num">{dayLabel(r.day)} 다녀옴</p>
                  {r.concert && <p className="truncate t-sub text-graphite">{r.concert.venue}</p>}
                </div>
              </Link>
              <Link to={r.postId ? `/community/post/${r.postId}` : `/community/write?concert=${r.concertId}`}
                className={`h-9 shrink-0 rounded-full px-3 t-sub font-semibold leading-9 ${r.postId ? 'bg-mist' : 'bg-ink text-paper'}`}>
                {r.postId ? '후기 보기' : '후기 쓰기'}
              </Link>
            </li>
          ))}
        </ul>
      ) : <Empty title="다녀온 공연이 없어요" body="지난 공연 상세에서 '다녀왔어요'를 누르면 여기에 모여요." />}
    </>
  )
}
