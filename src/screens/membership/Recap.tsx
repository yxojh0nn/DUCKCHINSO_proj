import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { RecapCard } from '@/components/RecapCard'
import { LockedShelf, RecapShelf } from '@/components/RecapShelf'
import { Button } from '@/components/ui/Button'
import { Empty } from '@/components/ui/Empty'
import { Toggle } from '@/components/ui/Toggle'
import { IconPalette } from '@/components/icons'
import { useRun } from '@/lib/actions'
import { keys, useConcerts, useDailyPhotos, useMe, useMemberBadge, useMembership, useRecapPublic, useRecapSource } from '@/lib/queries'
import { buildRecap, periodLabel, recapShelf, shelfLabel } from '@/lib/recap'
import { RECAP_COLORS, recapImage, recapPreview, type RecapCardOpts, type RecapColor } from '@/lib/recapImage'
import { saveMedia } from '@/lib/saveMedia'
import { toast, useUI } from '@/store/ui'
import { dayLabel } from '@/screens/calendar/Attend'

// QR 은 그 사람의 프로필로 (앱이 없으면 웹에서 열린다)
export const profileLink = (userId: string) => `https://duckchinso.com/profile/${userId}`

// 리캡 주인의 카드 정보 (닉네임·사진·뱃지). 본인은 내 정보, 남은 프로필에서
function useOwner(userId: string) {
  const me = useMe().data
  const self = me?.id === userId
  const profile = useQuery({ queryKey: keys.profile(userId), queryFn: () => api.getProfile(userId), enabled: !self && !!userId })
  const months = useMemberBadge(userId).data ?? null
  const p = self ? me : profile.data
  return { self, ready: !!p, opts: (qr: boolean): RecapCardOpts => ({ userId, nickname: p?.nickname ?? '', avatarUrl: p?.avatarUrl ?? null, months, qr: qr ? profileLink(userId) : null }) }
}

// 잠긴 서랍에 꽂아 둘 모양 카드: 지난 세 달 + 올해 (내용 없이 연·월만)
const lockedPeriods = () => {
  const d = new Date()
  const months = [3, 2, 1].map((k) => { const x = new Date(d.getFullYear(), d.getMonth() - k, 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}` })
  return [...months, String(d.getFullYear())]
}

// 진열대 한 묶음: 프로필·리캡 화면이 같이 쓴다. 기록이 없거나 비공개면 안내
//   kind: 리캡 화면은 연간(year)·월간(month)을 나눠 두 줄로, 프로필은 한 줄에 함께
export function RecapShelfSection({ userId, kind }: { userId: string; kind?: 'year' | 'month' }) {
  const nav = useNavigate()
  const src = useRecapSource(userId)
  const concerts = useConcerts().data ?? []
  const owner = useOwner(userId)
  const badge = useMemberBadge(userId)
  const mine = useMembership() // 본인은 결제 직후 바로 풀리게 내 멤버십으로 (뱃지는 10분 캐시)
  const { busy, run } = useRun()
  const [color, setColor] = useState<RecapColor>(defaultColor) // 꺼낸 카드의 색 (말풍선에서 고르면 바로 바뀐다, 기억하지 않음)
  if (src.isLoading || !owner.ready || (owner.self ? mine.isLoading : badge.isLoading)) return null
  // 멤버십이 없으면 잠긴 서랍 (본인에게는 멤버십 보러 가기)
  if (owner.self ? !mine.member : badge.data == null) return (
    <div className="pt-2">
      <LockedShelf periods={lockedPeriods()} message={owner.self ? '멤버십을 구매해야 리캡을 이용할 수 있어요' : '멤버십 회원만 리캡을 쓸 수 있어요'}
        action={owner.self && <Link to="/membership" className="mt-1 flex h-9 items-center rounded-full bg-white px-4 t-sub font-semibold text-[#18181A] active:opacity-75">멤버십 보기</Link>} />
    </div>
  )
  if (!src.data?.visible) return <p className="px-5 py-3 t-sub text-graphite">리캡을 공개하지 않았어요.</p>
  const periods = recapShelf(src.data.records).filter((p) => !kind || (kind === 'year') === (p.length === 4))
  if (!periods.length) return <p className="px-5 py-3 t-sub text-graphite">{kind === 'year' ? '공연을 다녀온 해가 생기면 연간 리캡이 쌓여요.' : '아직 리캡이 없어요.'}</p>
  const recapOf = (p: string) => buildRecap(p, src.data!.records, concerts)
  const opts = { ...owner.opts(true), color: owner.self ? color : undefined } // 남의 카드는 흑백 그대로
  const pick = setColor
  // 바로 저장: 지금 보이는 색 + QR, PNG
  const save = (p: string) => run(async () => {
    const url = URL.createObjectURL(await recapImage(recapOf(p), opts))
    try { await saveMedia(url) } catch (e) { if ((e as Error).name !== 'AbortError') toast('이미지를 저장하지 못했어요.') }
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  })
  return (
    <div className="pt-2">
      <RecapShelf periods={periods} count={(p) => recapOf(p).items.length}
        renderCard={(p) => <RecapCard recap={recapOf(p)} opts={opts} bare />}
        warm={(p) => {
          // 새로 꺼낼 때마다 기본 색(화면 테마)으로 돌아간다
          const c = defaultColor()
          setColor(c)
          recapPreview(recapOf(p), { ...opts, color: owner.self ? c : undefined }).catch(() => {})
        }}
        actions={owner.self ? (p) => (
          <CardActions color={color} onPick={pick} busy={busy} onSave={() => save(p)} onMore={() => nav(`/recap/${userId}/${p}`)} />
        ) : undefined} />
    </div>
  )
}

// 꺼낸 카드 아래 버튼: 왼쪽 2 팔레트, 오른쪽 8 저장. 팔레트를 누르면 바로 위에 색 말풍선이 뜨고,
//   색을 고르면 말풍선이 아래로 내려가며 사라지고 카드 색이 바로 바뀐다. 말풍선 밖을 누르면 그냥 닫힌다
function CardActions({ color, onPick, busy, onSave, onMore }: {
  color: RecapColor; onPick: (c: RecapColor) => void; busy: boolean; onSave: () => void; onMore: () => void
}) {
  const [bubble, setBubble] = useState<'closed' | 'open' | 'closing'>('closed')
  const wrap = useRef<HTMLDivElement>(null)
  const hide = () => { setBubble('closing'); window.setTimeout(() => setBubble((b) => (b === 'closing' ? 'closed' : b)), 200) }
  useEffect(() => {
    if (bubble !== 'open') return
    const out = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) hide() }
    document.addEventListener('pointerdown', out, true)
    return () => document.removeEventListener('pointerdown', out, true)
  }, [bubble])
  const shown = bubble !== 'closed'
  return (
    <div ref={wrap} className="relative flex w-full max-w-[320px] gap-2">
      {shown && (
        <div id="recap-colors" role="radiogroup" aria-label="카드 색"
          className="absolute bottom-[calc(100%+12px)] left-0 z-10 origin-bottom-left rounded-[16px] bg-white p-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.28)] motion-reduce:transition-none"
          style={{ animation: bubble === 'open' ? 'recap-bubble-in 180ms cubic-bezier(.2,.9,.3,1)' : undefined,
            transform: bubble === 'closing' ? 'translateY(10px)' : 'none', opacity: bubble === 'closing' ? 0 : 1,
            transition: 'transform 200ms ease-in, opacity 200ms ease-in' }}>
          <div className="flex gap-1.5">
            {RECAP_COLORS.map((c) => (
              <button key={c.id} type="button" role="radio" aria-checked={color === c.id} aria-label={c.name} title={c.name}
                onClick={() => { onPick(c.id); hide() }}
                className={`rounded-full p-[2px] ${color === c.id ? 'ring-2 ring-[#18181A]' : ''}`}>
                <span className="block h-7 w-7 rounded-full border border-[#E4E4E7]" style={{ background: c.bg }} />
              </button>
            ))}
          </div>
          <button type="button" onClick={onMore} className="mt-2 block w-full rounded-[10px] py-1.5 text-left text-[12px] font-semibold text-[#6B6B72] active:bg-[#F4F4F5]">QR·덕질 사진 설정 ›</button>
          {/* 말풍선 꼬리: 팔레트 버튼 가운데를 가리킨다 */}
          <span aria-hidden className="absolute -bottom-[6px] left-[24px] h-3 w-3 rotate-45 bg-white" />
        </div>
      )}
      <button type="button" aria-label="카드 색 고르기" title="카드 색 고르기" aria-expanded={bubble === 'open'} aria-controls="recap-colors"
        onClick={() => (bubble === 'open' ? hide() : setBubble('open'))}
        className={`flex h-11 basis-1/5 items-center justify-center rounded-[12px] text-white ${bubble === 'open' ? 'bg-white/30' : 'bg-white/15 active:bg-white/25'}`}>
        <IconPalette size={22} />
      </button>
      <button type="button" disabled={busy} onClick={onSave}
        className="h-11 flex-1 rounded-[12px] bg-white t-body font-semibold text-[#18181A] active:opacity-80 disabled:opacity-50">
        {busy ? '만드는 중…' : '저장·공유'}
      </button>
    </div>
  )
}

// /recap/:userId — 리캡 진열대 (MY > 내 리캡, 프로필)
export function RecapShelfScreen() {
  const { userId = '' } = useParams()
  const me = useMe().data
  const self = me?.id === userId
  const { member } = useMembership()
  const pub = useRecapPublic(self)
  const nick = useOwner(userId)
  const badge = useMemberBadge(userId)
  const src = useRecapSource(userId)
  if (!me) return <AppHeader back title="리캡" />
  if (self && !member) return <MembersOnly />
  return (
    <div className="pb-[max(24px,env(safe-area-inset-bottom))]">
      <AppHeader back title={self ? '내 리캡' : `${nick.opts(false).nickname}의 리캡`} />
      {self && (
        <p className="mx-5 mb-4 rounded-[12px] bg-mist px-3.5 py-2.5 t-sub text-graphite">
          {pub.data === false ? '내 리캡은 나만 볼 수 있어요.' : '내 리캡은 프로필에서 다른 사람도 볼 수 있어요.'}{' '}
          <Link to="/my/settings" className="font-semibold text-ink underline underline-offset-4">설정에서 바꾸기</Link>
        </p>
      )}
      {/* 멤버십이 없거나 비공개면 안내 한 번만, 볼 수 있으면 한눈에 보기 + 연간·월간 진열대 */}
      {badge.data == null || !src.data?.visible ? <RecapShelfSection userId={userId} /> : (
        <>
          <RecapOverview records={src.data.records} />
          <section className="mt-8">
            <h2 className="px-5 t-head">연간 리캡</h2>
            <RecapShelfSection userId={userId} kind="year" />
          </section>
          <section className="mt-6">
            <h2 className="px-5 t-head">월간 리캡</h2>
            <RecapShelfSection userId={userId} kind="month" />
          </section>
        </>
      )}
    </div>
  )
}

// 한눈에 보기: 가장 최근 해의 숫자 셋, 달마다 다녀온 공연(막대)
function RecapOverview({ records }: { records: { concertId: string; day: string }[] }) {
  const concerts = useConcerts().data ?? []
  const [pick, setPick] = useState<number | null>(null)
  if (!records.length) return null
  const year = records.map((r) => r.day.slice(0, 4)).sort().at(-1)!
  const items = buildRecap(year, records, concerts).items
  const byMonth = Array.from({ length: 12 }, (_, i) => items.filter((it) => Number(it.day.slice(5, 7)) === i + 1).length)
  const max = Math.max(...byMonth)
  const top = byMonth.lastIndexOf(max) // 같으면 더 최근 달
  const days = new Set(items.map((it) => it.day)).size
  const venues = new Set(items.map((it) => it.venue).filter(Boolean)).size
  const shown = pick ?? top
  return (
    <>
      <section className="mx-5 rounded-[20px] bg-mist px-5 pb-5 pt-5" aria-label={`${year}년 한눈에 보기`}>
        <h2 className="t-sub font-semibold text-graphite">{year}년 한눈에 보기</h2>
        <dl className="mt-3 grid grid-cols-3 gap-2">
          {[['다녀온 공연', items.length, '개'], ['공연 간 날', days, '일'], ['공연장', venues, '곳']].map(([k, v, u]) => (
            <div key={k}>
              <dt className="t-cap text-graphite">{k}</dt>
              <dd className="mt-0.5 num"><span className="text-[26px] font-black leading-none tracking-[-0.02em]">{v}</span><span className="ml-0.5 t-sub font-semibold">{u}</span></dd>
            </div>
          ))}
        </dl>
        <h3 className="mt-5 t-cap text-graphite">달마다 다녀온 공연</h3>
        {/* 막대 하나 = 한 달. 누르거나 올리면 그 달 숫자, 처음엔 가장 바빴던 달 */}
        <p className="mt-1 t-sub font-semibold num" aria-live="polite">{shown + 1}월 {byMonth[shown]}개{pick == null && max > 0 ? ' · 가장 바빴던 달' : ''}</p>
        <ol className="mt-2 flex h-[72px] items-end gap-[2px]" aria-label="달마다 다녀온 공연 수">
          {byMonth.map((n, i) => (
            <li key={i} className="flex h-full flex-1 flex-col justify-end">
              <button type="button" onClick={() => setPick(i)} onMouseEnter={() => setPick(i)} onFocus={() => setPick(i)}
                aria-label={`${i + 1}월 ${n}개`} className="flex h-full w-full items-end justify-center">
                <span className={`block w-full max-w-[14px] rounded-t-[4px] ${n ? (i === shown ? 'bg-ink' : 'bg-control-line') : 'bg-hairline'}`}
                  style={{ height: n ? `${Math.max(10, (n / max) * 100)}%` : 3 }} />
              </button>
            </li>
          ))}
        </ol>
        <div aria-hidden className="mt-1 flex gap-[2px]">
          {byMonth.map((_, i) => <span key={i} className={`flex-1 text-center text-[10px] num ${i === shown ? 'font-semibold text-ink' : 'text-graphite'}`}>{i + 1}</span>)}
        </div>
      </section>
    </>
  )
}

// 카드 기본 색: 앱이 밝은 테마면 흰색(흑백), 어두운 테마면 검은색. 고른 색은 기억하지 않아 화면을 나갔다 오면 다시 기본 색
const defaultColor = (): RecapColor => {
  const t = useUI.getState().theme
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  return dark ? 'black' : 'mono'
}

// /recap/:userId/:period — 전체 리캡: 카드 + (본인) 색·QR 선택·저장, 이 기간의 덕질 사진
export function RecapDetail() {
  const { userId = '', period = '' } = useParams()
  const src = useRecapSource(userId)
  const concerts = useConcerts().data ?? []
  const owner = useOwner(userId)
  const daily = useDailyPhotos().data ?? []
  const [withQr, setWithQr] = useState(true)
  const [color, setColor] = useState<RecapColor>(defaultColor)
  const { busy, run } = useRun()
  const title = shelfLabel(period)
  if (src.isLoading || !owner.ready) return <AppHeader back title={title} />
  if (!src.data?.visible) return <><AppHeader back title={title} /><Empty title="볼 수 없는 리캡이에요" body="리캡을 공개하지 않았거나 멤버십이 끝났어요." /></>
  const recap = buildRecap(period, src.data.records, concerts)
  const opts = { ...owner.opts(withQr), color }
  const photos = owner.self ? daily.filter((p) => p.day.startsWith(period)) : []
  const save = () => run(async () => {
    const url = URL.createObjectURL(await recapImage(recap, opts)) // 저장본은 PNG 로 새로
    try { await saveMedia(url) } catch (e) { if ((e as Error).name !== 'AbortError') toast('이미지를 저장하지 못했어요.') }
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  })
  return (
    <div className="pb-[max(24px,env(safe-area-inset-bottom))]">
      <AppHeader back title={title} />
      <div className="mx-auto max-w-[400px] px-5">
        {recap.items.length ? <RecapCard recap={recap} opts={opts} /> : <Empty title={`${periodLabel(period)}에 다녀온 공연이 없어요`} />}
        {owner.self && recap.items.length > 0 && (
          <>
            <fieldset className="mt-4">
              <legend className="t-body font-semibold">카드 색</legend>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {RECAP_COLORS.map((c) => (
                  <label key={c.id} title={c.name} className="cursor-pointer">
                    <input type="radio" name="recap-color" className="peer sr-only" checked={color === c.id} onChange={() => setColor(c.id)} aria-label={c.name} />
                    <span className="block rounded-full p-[2px] ring-ink peer-checked:ring-2 peer-focus-visible:outline peer-focus-visible:outline-2">
                      <span className="block h-7 w-7 rounded-full border border-hairline" style={{ background: c.bg }} />
                    </span>
                  </label>
                ))}
              </div>
              <p className="mt-1.5 t-sub text-graphite">{RECAP_COLORS.find((c) => c.id === color)?.name} · 저장하는 카드에만 적용돼요</p>
            </fieldset>
            <div className="mt-4 flex items-center justify-between gap-4">
              <span className="min-w-0">
                <span className="block t-body font-semibold">QR 코드 넣기</span>
                <span className="block t-sub text-graphite">찍으면 내 덕친소 프로필로 들어와요</span>
              </span>
              <Toggle label="카드에 QR 코드 넣기" checked={withQr} onChange={setWithQr} />
            </div>
            <Button block className="mt-4" disabled={busy} onClick={save}>{busy ? '이미지 만드는 중…' : '이미지로 저장·공유'}</Button>
          </>
        )}
      </div>
      {photos.length > 0 && (
        <section className="mt-8 px-5">
          <h2 className="t-head">덕질 사진 <span className="t-sub font-medium text-graphite num">{photos.length}장</span></h2>
          <ul className="mt-3 grid grid-cols-3 gap-1.5">
            {photos.map((p) => (
              <li key={p.day} className="relative">
                <img src={p.photoUrl} alt={`${dayLabel(p.day)} 덕질 사진`} className="aspect-square w-full rounded-[8px] object-cover" />
                <span className="absolute bottom-1 left-1 rounded-full bg-black/45 px-1.5 text-[10px] font-semibold text-white num">{dayLabel(p.day)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function MembersOnly() {
  return (
    <>
      <AppHeader back title="리캡" />
      <Empty title="리캡은 멤버십 혜택이에요" body="다녀온 공연과 덕질 사진을 달마다, 해마다 카드로 모아 드려요." />
      <div className="px-5"><Link to="/membership" className="flex h-[52px] items-center justify-center rounded-[14px] bg-ink t-head text-paper active:opacity-75">멤버십 보기</Link></div>
    </>
  )
}
