import { useNavigate, useParams } from 'react-router-dom'
import { ARTISTS, CONCERTS } from '@/data/mock'
import { DAY_MS, kstDayKey } from '@/lib/date'
import { openGoogleMap, openKakaoMap, openTicket } from '@/lib/external'
import { useAppStore } from '@/store/useAppStore'
import { AppHeader } from '@/components/AppHeader'
import { Chevron, List } from '@/components/List'
import { Button } from '@/components/ui/Button'

const fmt = (iso: string, opt: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', ...opt }).format(new Date(iso))

const daysUntil = (iso: string, now: number) =>
  Math.round((Date.parse(kstDayKey(iso)) - Date.parse(kstDayKey(now))) / DAY_MS)

function Field({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0">
      <dt className="t-cap text-paper/55">{label}</dt>
      <dd className="mt-1 t-head num">{value}</dd>
      {sub && <dd className="t-sub text-paper/70 num">{sub}</dd>}
    </div>
  )
}

const ExternalIcon = () => (
  <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 2h6v6M10 2L3 9" /></svg>
)

// 공연 상세: Apple Wallet 입장권 형태. 일시·예매 오픈·장소·예매처 4가지만 보여 준다 (기획서 5.2)
export default function ConcertDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const now = useAppStore((s) => s.now)()
  const c = CONCERTS.find((x) => x.id === id)
  if (!c) return <><AppHeader title="공연" back /><p className="px-5 py-10 t-body text-graphite">공연 정보를 찾을 수 없어요.</p></>

  const artists = c.artistIds.map((aid) => ARTISTS.find((a) => a.id === aid)?.name).filter(Boolean).join(', ')
  const opened = Date.parse(c.ticketOpenAt) <= now
  const dDay = daysUntil(c.startsAt, now)
  const dOpen = daysUntil(c.ticketOpenAt, now)

  return (
    <>
      <AppHeader title={artists} back />
      <div className="flex-1 pb-10">
        <article aria-label="공연 입장권" className="mx-4 mt-4 overflow-hidden rounded-[22px] bg-ink text-paper">
          <div className="px-5 pb-6 pt-5">
            <p className="t-sub text-paper/60">{artists}</p>
            <h1 className="mt-1 t-title">{c.title}</h1>
            <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5">
              <Field
                label="공연 일시"
                value={fmt(c.startsAt, { month: 'long', day: 'numeric', weekday: 'short' })}
                sub={fmt(c.startsAt, { hour: '2-digit', minute: '2-digit', hour12: false })}
              />
              <Field
                label="예매 오픈"
                value={fmt(c.ticketOpenAt, { month: 'long', day: 'numeric', weekday: 'short' })}
                sub={fmt(c.ticketOpenAt, { hour: '2-digit', minute: '2-digit', hour12: false })}
              />
              <div className="col-span-2">
                <Field label="공연 장소" value={c.venue} sub={c.region} />
              </div>
            </dl>
          </div>

          {/* 절취선: 양옆 반원은 바탕색으로 뚫는다 */}
          <div aria-hidden className="relative h-0">
            <span className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-paper" />
            <span className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-paper" />
            <span className="absolute inset-x-5 top-0 border-t border-dashed border-paper/25" />
          </div>

          <div className="flex items-end justify-between px-5 pb-5 pt-6">
            <div>
              <p className="t-cap text-paper/55">예매처</p>
              <p className="mt-1 t-head">{c.ticketLinks.map((t) => t.vendor).join(', ')}</p>
              <p className="mt-0.5 t-sub text-paper/70">
                {opened ? '예매 진행 중' : dOpen === 0 ? '오늘 예매 오픈' : `예매 오픈까지 ${dOpen}일`}
              </p>
            </div>
            <p className="text-right">
              <span className="block t-cap text-paper/55">{dDay > 0 ? '공연까지' : dDay === 0 ? '오늘 공연' : '공연 종료'}</span>
              {dDay > 0 && <span className="block text-[44px] font-extralight leading-[44px] tracking-[-0.04em] num">D-{dDay}</span>}
            </p>
          </div>
        </article>

        <div className="mt-5 flex flex-col gap-2 px-4">
          {c.ticketLinks.map((t, i) => (
            <Button key={t.vendor} block variant={i === 0 ? 'primary' : 'secondary'} onClick={() => openTicket(t.url)}>
              {t.vendor}에서 예매하기 <ExternalIcon />
            </Button>
          ))}
          <p className="px-1 t-sub text-graphite">예매처 사이트가 새 창으로 열려요. 가격과 좌석은 예매처에서 확인해 주세요.</p>
        </div>

        <List header="길찾기">
          {[
            { label: '카카오맵에서 열기', go: () => openKakaoMap(c.venueQuery) },
            { label: '구글 지도에서 열기', go: () => openGoogleMap(c.venueQuery) },
          ].map((m, i) => (
            <li key={m.label} className="group relative">
              <button onClick={m.go} className="flex min-h-11 w-full items-center justify-between px-5 py-2.5 t-body active:bg-mist">
                {m.label}
                <ExternalIcon />
              </button>
              {i === 0 && <span aria-hidden className="absolute bottom-0 left-5 right-0 h-px bg-hairline/70" />}
            </li>
          ))}
        </List>

        <List>
          <li>
            <button onClick={() => nav(`/match?artist=${c.artistIds[0]}`)} className="flex min-h-11 w-full items-center gap-3 px-5 py-3 text-left active:bg-mist">
              <span className="flex-1">
                <span className="block t-body">같은 아티스트를 좋아하는 사람</span>
                <span className="block t-sub text-graphite">취향이 겹치는 사람에게 대화를 요청해 보세요</span>
              </span>
              <Chevron />
            </button>
          </li>
        </List>
      </div>
    </>
  )
}
