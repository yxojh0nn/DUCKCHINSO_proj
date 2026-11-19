import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api, type Attendance, type Concert } from '@/api'
import { ImageButton } from '@/components/ImageButton'
import { Poster } from '@/components/Poster'
import { IconPhoto } from '@/components/icons'
import { Empty } from '@/components/ui/Empty'
import { useRun } from '@/lib/actions'
import { monthGrid } from '@/lib/calendar'
import { keys, useMembership } from '@/lib/queries'
import { toast } from '@/store/ui'
import { dayLabel } from './Attend'

const WEEK = ['일', '월', '화', '수', '목', '금', '토']
type Rec = Attendance & { concert: Concert | undefined }

// 덕질 캘린더: 그날의 사진(없으면 다녀온 공연의 후기 사진, 그것도 없으면 포스터)을 칸에 작게 깐다. 공연 캘린더와 같은 격자·날짜 버튼
export function ReviewMonth({ year, month, records, photos, selected, today, onSelect }: {
  year: number; month: number; records: Rec[]; photos: Map<string, string>; selected: string | null; today: string; onSelect: (day: string) => void
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
            const shot = photos.get(day) ?? top?.photoUrl ?? null
            const isSel = day === selected
            const label = `${dayLabel(day)}${recs.length ? `, 다녀온 공연 ${recs.length}개` : ''}${photos.has(day) ? ', 사진 있음' : ''}${day === today ? ', 오늘' : ''}`
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
                    {recs.length > 1 && <span className="absolute -right-1.5 -top-1 rounded-full bg-ink px-1 text-[9px] font-bold leading-[13px] text-paper">{recs.length}</span>}
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

// 고른 날의 덕질 사진 한 장: 보기·바꾸기·지우기 (멤버십 회원). 오늘과 지난 날만
export function DailyPhotoBlock({ day, url }: { day: string; url: string | null }) {
  const qc = useQueryClient()
  const { member } = useMembership()
  const { busy, run } = useRun()
  const set = (b: Blob | null) => run(async () => {
    await api.setDailyPhoto(day, b)
    await qc.invalidateQueries({ queryKey: keys.dailyPhotos })
    toast(b ? `${dayLabel(day)} 사진을 담았어요` : '사진을 지웠어요')
  })
  return (
    <div className="mx-5 mt-3 flex items-center gap-3.5 rounded-[14px] bg-mist p-3">
      {url
        ? <img src={url} alt={`${dayLabel(day)} 덕질 사진`} className="h-20 w-20 shrink-0 rounded-[10px] object-cover" />
        : <span aria-hidden className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[10px] bg-paper text-graphite"><IconPhoto /></span>}
      <div className="min-w-0 flex-1">
        <p className="t-body font-semibold">{dayLabel(day)}의 덕질 사진</p>
        {!member ? (
          <p className="mt-0.5 t-sub text-graphite">하루 한 장 사진 기록은 멤버십 혜택이에요. <Link to="/membership" className="font-semibold text-ink underline underline-offset-4">멤버십 보기</Link></p>
        ) : (
          <div className="mt-2 flex gap-2">
            <ImageButton label={url ? '사진 바꾸기' : '사진 담기'} onPick={([b]) => b && set(b)}
              className="h-9 rounded-full bg-ink px-3.5 t-sub font-semibold text-paper disabled:opacity-40">{url ? '바꾸기' : '사진 담기'}</ImageButton>
            {url && <button disabled={busy} onClick={() => set(null)} className="h-9 rounded-full px-3 t-sub font-semibold text-danger">지우기</button>}
          </div>
        )}
      </div>
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
