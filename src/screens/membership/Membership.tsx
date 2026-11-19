import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorText, isDemo, type Membership as M } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { BusinessFooter } from '@/components/BusinessFooter'
import { BADGE_TIERS, MemberBadge, nextBadgeIn, tierIndex } from '@/components/MemberBadge'
import { MenuGroup, MenuRow } from '@/components/MenuRow'
import { IconChevron, IconMembership } from '@/components/icons'
import { Poster } from '@/components/Poster'
import { Button } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { TextField } from '@/components/ui/Field'
import { buyerError, type Buyer } from '@/lib/buyer'
import { Confirm } from '@/components/ui/Confirm'
import { Empty } from '@/components/ui/Empty'
import { fmtDay } from '@/lib/date'
import { keys, useAttendance, useConcerts, useMe, useMembership } from '@/lib/queries'
import { buildRecap, periodLabel, recapMonths } from '@/lib/recap'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { addMonth, finishRedirect, payMethods, startMembership, webPayOn, won, type PayMethodId } from '@/lib/payment'
import { BENEFITS } from '@/data/business'
import { toast } from '@/store/ui'
import { useRun } from '@/lib/actions'


// 멤버십 탭: 멤버는 내 멤버십·혜택, 멤버가 아니면 같은 화면을 흐리게 깔고 안내 카드 하나 (과하게 막지 않는다)
export default function Membership() {
  const me = useMe().data
  const { m, member, isLoading } = useMembership()
  usePayReturn()
  if (me?.isGuest) return (<><AppHeader large title="멤버십" /><Empty title="멤버십은 회원만 이용할 수 있어요" body="회원으로 로그인한 뒤 다시 찾아 주세요." /></>)
  return (
    <>
      <AppHeader large title="멤버십" />
      {isLoading ? <p className="px-5 py-8 t-sub text-graphite">불러오는 중…</p> : (
        member ? <MemberView m={m} /> : <Locked m={m} />
      )}
      <div className="pb-8"><BusinessFooter className="mx-5 mt-8 border-t border-hairline pt-5" /></div>
    </>
  )
}

function MemberView({ m }: { m: M }) {
  const me = useMe().data
  return (
    <div className="pb-8">
      {m.months != null && <BadgeHero months={m.months} />}
      <MySubscription m={m} />
      <MenuGroup title="내 혜택">
        <MenuRow label="관심 아티스트" to="/my/info/prefs"
          right={<span className="t-sub text-graphite num">{me?.artistIds.length ?? 0}/{m.maxArtists}</span>} />
        <MenuRow label="관심 장르" to="/my/info/prefs"
          right={<span className="t-sub text-graphite num">{me?.genreIds.length ?? 0}/{m.maxGenres}</span>} />
      </MenuGroup>
      <RecapEntry />
      {isDemo && <DemoTools m={m} />}
    </div>
  )
}

// 지금 뱃지 크게 + 단계표 (받은 뱃지는 색, 앞으로 받을 뱃지는 흐리게) + 다음 뱃지까지 남은 개월
function BadgeHero({ months }: { months: number }) {
  const now = tierIndex(months)
  const left = nextBadgeIn(months)
  return (
    <section className="mx-5 mt-2 rounded-[20px] bg-mist px-5 pb-5 pt-6">
      <div className="flex items-center gap-4">
        <MemberBadge months={months} size={72} />
        <div className="min-w-0">
          <p className="t-title num">{months === 0 ? '구독 첫 달이에요' : `${months}개월째 구독 중`}</p>
          <p className="mt-1 t-sub text-graphite">
            {left ? `${left}개월 더 이어 가면 다음 뱃지를 받아요` : '가장 높은 뱃지를 받았어요'}
          </p>
        </div>
      </div>
      <ol aria-label="구독 뱃지 단계" className="mt-5 grid grid-cols-6 gap-1">
        {BADGE_TIERS.map((b, i) => (
          <li key={b.min} className="flex flex-col items-center gap-1" aria-current={i === now ? 'step' : undefined}>
            <span className={`rounded-full p-1 ${i === now ? 'ring-2 ring-ink' : ''}`}>
              <MemberBadge months={b.min} size={34} dim={i > now} tip={false} />
            </span>
            <span className={`t-cap num ${i === now ? 'font-semibold text-ink' : 'text-graphite'}`}>{b.min}개월</span>
          </li>
        ))}
      </ol>
    </section>
  )
}

// 리캡 들어가는 곳: 가장 최근 달에 다녀온 공연 수와 포스터 몇 장 (기록이 없으면 기록하는 법)
function RecapEntry() {
  const me = useMe().data
  const q = useAttendance()
  const records = q.data ?? []
  const concerts = useConcerts().data ?? []
  if (q.isLoading) return null // 불러오기 전에 "기록이 없어요"가 잠깐 보이지 않게
  const latest = recapMonths(records)[0]
  const items = latest ? buildRecap(latest, records, concerts).items : []
  return (
    <section className="mt-6 px-5">
      <h2 className="t-sub font-semibold text-graphite">월간·연간 리캡</h2>
      {latest ? (
        <Link to={`/recap/${me?.id}`} className="mt-2 flex items-center gap-4 rounded-[16px] border border-hairline px-4 py-4 active:bg-mist">
          <span aria-hidden className="flex shrink-0 -space-x-3">
            {items.slice(0, 3).map((it) => (
              <Poster key={`${it.concertId}-${it.day}`} id={it.concertId} url={it.posterUrl} title="" className="h-[56px] w-[40px] rounded-[6px] ring-2 ring-paper" />
            ))}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block t-head">{periodLabel(latest)} 리캡</span>
            <span className="block t-sub text-graphite num">다녀온 공연 {items.length}개 · 카드로 저장·공유</span>
          </span>
          <IconChevron size={18} className="text-graphite" />
        </Link>
      ) : (
        <div className="mt-2 rounded-[16px] border border-hairline px-5 py-6 text-center">
          <p className="t-head">아직 다녀온 공연이 없어요</p>
          <p className="mt-1 t-sub text-graphite">지난 공연 상세에서 '다녀왔어요'를 누르면 달마다, 해마다 리캡 카드로 모아 드려요.</p>
        </div>
      )}
    </section>
  )
}

// 내 구독 관리: 구독 시작일·몇 개월째·결제 수단·다음 결제일·요금, 해지 예약과 해지 취소 (해지해도 결제한 기간 끝까지 이용)
function MySubscription({ m }: { m: M }) {
  const qc = useQueryClient()
  const { busy, run } = useRun()
  const [ask, setAsk] = useState(false)
  const until = m.subUntil ? fmtDay(m.subUntil) : ''
  const next = m.nextChargeAt ? fmtDay(m.nextChargeAt) : until
  const setRenew = (on: boolean) => run(async () => {
    await api.setMyAutoRenew(on)
    await qc.invalidateQueries({ queryKey: keys.membership })
    setAsk(false)
    toast(on ? '해지를 취소했어요. 구독이 계속 이어져요' : `해지 예약했어요. ${until}까지 혜택은 그대로예요`)
  })
  return (
    <section className="mt-6">
      <h2 className="px-5 pb-1 t-sub font-semibold text-graphite">내 구독</h2>
      <dl className="mx-5 divide-y divide-hairline rounded-[16px] border border-hairline">
        <Row label="상태" value={m.pastDue ? '결제 실패' : m.autoRenew ? '구독 중' : '해지 예약됨'} tone={m.pastDue ? 'text-danger' : m.autoRenew ? 'text-success' : 'text-notice'} />
        <Row label="구독 시작일" value={m.subStartedAt ? fmtDay(m.subStartedAt) : '-'} />
        <Row label="구독 기간" value={m.months === 0 ? '첫 달' : `${m.months}개월째`} />
        {m.methodLabel && <Row label="결제 수단" value={m.methodLabel} />}
        <Row label={m.pastDue ? '다시 결제 시도' : m.autoRenew ? '다음 결제일' : '이용 종료일'} value={(m.pastDue || m.autoRenew ? next : until) || '-'} />
        {m.nextAmountKrw != null && <Row label="다음 결제 금액" value={won(m.nextAmountKrw)} />}
      </dl>
      {m.pastDue ? (
        <div className="mx-5 mt-3 rounded-[12px] bg-mist px-4 py-3">
          <p className="t-body font-semibold">결제가 되지 않았어요</p>
          <p className="mt-1 t-sub text-graphite">{until}까지 혜택은 그대로예요. 자동으로 몇 번 더 결제를 시도하고, 결제일부터 14일 안에 결제되면 구독 개월 수도 이어져요. 다른 결제 수단으로 바로 결제할 수도 있어요.</p>
          <StartPanel m={m} again />
        </div>
      ) : (
        <p className="mx-5 mt-2 t-sub text-graphite">
          {m.autoRenew ? `${next}에 다음 달 요금이 등록한 결제 수단(${m.methodLabel ?? '-'})에서 자동 결제돼요.` : `${until}까지 혜택을 쓰고, 그 뒤로는 결제되지 않아요.`}
        </p>
      )}
      <div className="mx-5 mt-3">
        {m.autoRenew || m.pastDue
          ? <Button block variant="secondary" disabled={busy} onClick={() => setAsk(true)}>구독 해지</Button>
          : <Button block disabled={busy} onClick={() => setRenew(true)}>해지 취소하고 계속 구독하기</Button>}
      </div>
      <Confirm open={ask} title="구독을 해지할까요?" confirmLabel="해지 예약" danger
        message={m.pastDue ? '결제 재시도를 멈추고 구독을 지금 끝내요.' : `${until}까지는 지금처럼 혜택과 뱃지가 유지되고, 그 뒤로 결제되지 않아요. 끝난 뒤 14일 안에 다시 시작하면 구독 개월 수가 이어져요.`}
        onConfirm={() => setRenew(false)} onClose={() => setAsk(false)} />
    </section>
  )
}
function Row({ label, value, tone = '' }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <dt className="t-sub text-graphite">{label}</dt>
      <dd className={`t-body font-semibold num ${tone}`}>{value}</dd>
    </div>
  )
}

// 멤버가 아닐 때: 화면 자체가 "아직 멤버십이 없어요" 안내 (혜택 소개 + 시작 버튼)
function Locked({ m }: { m: M }) {
  const lapsed = !!m.subUntil
  return (
    <div className="px-5 pb-10 pt-2">
      <section className="rounded-[20px] bg-mist px-5 pb-6 pt-7 text-center">
        <span className="inline-flex text-ink"><IconMembership size={44} /></span>
        <h2 className="mt-3 t-title">{lapsed ? '멤버십이 끝났어요' : '아직 멤버십이 없어요'}</h2>
        <p className="mx-auto mt-1.5 max-w-[320px] t-sub text-graphite">
          {lapsed ? '담아 둔 아티스트는 그대로 있어요. 다시 시작하면 바로 돌아와요.' : '멤버십으로 덕질을 더 넓게 챙겨 보세요.'}
        </p>
      </section>
      {/* 시작(결제)을 혜택보다 먼저: 스크롤 없이 바로 보이게 */}
      <StartPanel m={m} />
      <h3 className="mt-6 t-sub font-semibold text-graphite">멤버십 혜택</h3>
      <ul className="mt-1 divide-y divide-hairline">
        {BENEFITS.map((b) => (
          <li key={b.title} className="py-4">
            <p className="t-body font-semibold">{b.title}</p>
            <p className="mt-0.5 t-sub text-graphite">{b.body}</p>
            {b.badges && (
              <div aria-hidden className="mt-3 flex items-center gap-2">
                {BADGE_TIERS.map((t) => <MemberBadge key={t.min} months={t.min} size={32} tip={false} />)}
              </div>
            )}
          </li>
        ))}
      </ul>
      {isDemo && <DemoTools m={m} />}
    </div>
  )
}

// 결제 패널: 결제 수단 고르기 + 정기결제 고지 + 동의 → 결제창. 금액은 서버가 정한 값을 보여 주기만 한다
//   again: 결제 실패 중 다른 수단으로 다시 결제 (서버가 이전 구독을 대신한다)
function StartPanel({ m, again }: { m: M; again?: boolean }) {
  const qc = useQueryClient()
  const offer = useQuery({ queryKey: ['membershipOffer'], queryFn: () => api.membershipOffer() })
  const methods = payMethods()
  const [method, setMethod] = useState<PayMethodId | null>(null)
  const [agree, setAgree] = useState(false)
  const me = useMe().data
  const [buyer, setBuyer] = useState<Buyer>({ name: '', phone: '', email: me?.email ?? '' })
  const { busy, run } = useRun()
  if (!webPayOn()) return <p className="mt-4 rounded-[12px] bg-mist px-4 py-3 text-center t-sub text-graphite">결제는 준비 중이에요. 열리면 공지로 알려 드릴게요.</p>
  const o = offer.data
  if (!o) return null
  if (!o.available) return <p className="mt-4 rounded-[12px] bg-mist px-4 py-3 text-center t-sub text-graphite">결제는 준비 중이에요. 열리면 공지로 알려 드릴게요.</p>
  const first = !again && o.firstPriceKrw != null ? o.firstPriceKrw : o.priceKrw
  const pick = methods.find((x) => x.id === method)
  const buyerErr = pick?.needsBuyer ? buyerError(buyer) : null
  const go = () => run(async () => {
    try {
      const r = await startMembership(pick!, pick!.needsBuyer ? buyer : undefined)
      if (r === 'redirect') return
      await qc.invalidateQueries({ queryKey: keys.membership })
      toast(r === 'pending' ? '결제를 확인하고 있어요. 잠시 뒤 다시 열어 주세요.' : '멤버십을 시작했어요!')
    } catch (e) { toast(errorText(e)) }
  })
  return (
    <section className="mt-4" aria-label="멤버십 결제">
      <p className="t-head num">
        {first !== o.priceKrw ? <>첫 달 {won(first)} <span className="t-sub font-medium text-graphite">이후 매월 {won(o.priceKrw)}</span></> : <>매월 {won(o.priceKrw)}</>}
      </p>
      <fieldset className="mt-3">
        <legend className="t-sub font-semibold text-graphite">결제 수단</legend>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {methods.map((x) => (
            <label key={x.id} className={`flex h-11 cursor-pointer items-center justify-center rounded-[12px] border t-body font-semibold ${method === x.id ? 'border-ink bg-ink text-paper' : 'border-hairline'}`}>
              <input type="radio" name="pay-method" className="sr-only" checked={method === x.id} onChange={() => setMethod(x.id)} />{x.label}
            </label>
          ))}
        </div>
      </fieldset>
      {pick?.needsBuyer && <BuyerFields buyer={buyer} onChange={setBuyer} />}
      {buyerErr && (buyer.name || buyer.phone) && <p role="alert" className="mt-2 t-sub text-danger">{buyerErr}</p>}
      <PayNotice first={first} price={o.priceKrw} lapsedAt={m.subUntil} />
      <div className="mt-2"><Checkbox checked={agree} onChange={setAgree}>위 내용을 확인했고, 매월 자동 결제에 동의해요 (필수)</Checkbox></div>
      <Button block className="mt-2" disabled={busy || !pick || !agree || !!buyerErr} onClick={go}>
        {busy ? '결제 중…' : `${won(first)} 결제하고 ${again ? '다시 이어 가기' : m.subUntil ? '다시 시작하기' : '시작하기'}`}
      </Button>
    </section>
  )
}

// 카드 결제(KG이니시스)에 필요한 구매자 정보. 결제창에만 넘기고 덕친소는 저장하지 않는다
function BuyerFields({ buyer, onChange }: { buyer: Buyer; onChange: (b: Buyer) => void }) {
  const set = (k: keyof Buyer) => (e: React.ChangeEvent<HTMLInputElement>) => onChange({ ...buyer, [k]: e.target.value })
  return (
    <fieldset className="mt-4 space-y-4">
      <legend className="t-sub font-semibold text-graphite">구매자 정보</legend>
      <TextField label="이름" autoComplete="name" maxLength={30} value={buyer.name} onChange={set('name')} />
      <TextField label="휴대폰 번호" type="tel" inputMode="tel" autoComplete="tel" placeholder="010-0000-0000" maxLength={13} value={buyer.phone} onChange={set('phone')} />
      <TextField label="이메일" type="email" autoComplete="email" value={buyer.email} onChange={set('email')}
        hint="카드 결제사(KG이니시스)가 결제·영수증 발송에 요구하는 정보예요. 결제창에만 전달하고 덕친소에는 저장하지 않아요." />
    </fieldset>
  )
}

// 정기결제 고지 (전자상거래법: 금액·주기·다음 결제일·해지 방법·환불을 결제 전에). 문구 근거: docs/결제_멤버십_연동_설계.md 11장
function PayNotice({ first, price, lapsedAt }: { first: number; price: number; lapsedAt: string | null }) {
  const nextDay = addMonth(new Date())
  const keep = lapsedAt && Date.now() - Date.parse(lapsedAt) <= 14 * 86_400_000
  return (
    <ul className="mt-4 list-disc space-y-1 rounded-[12px] bg-mist py-3 pl-8 pr-4 t-sub text-graphite">
      <li>오늘 {won(first)}이 결제되고, 이후 <b className="font-semibold text-ink">매월 {nextDay.getDate()}일</b>(그 날짜가 없는 달은 말일)에 {won(price)}이 자동 결제돼요. 다음 결제일은 {fmtDay(nextDay.toISOString())}이에요.</li>
      <li>멤버십 탭 › 내 구독 › 구독 해지에서 언제든 해지할 수 있어요. 해지해도 결제한 기간 끝까지 이용할 수 있어요.</li>
      <li>결제 후 7일 안에 요청하면 전액 환불해 드려요. 그 뒤 중도 해지 환불은 <Link to="/legal/refund" className="underline underline-offset-2">환불 정책</Link>을 따라요.</li>
      <li>결제가 실패하면 3일 동안 혜택을 유지하며 다시 시도해요. 결제일부터 14일 안에 결제되면 구독 개월 수가 이어져요.</li>
      {keep && <li>지난 구독이 끝난 지 14일이 안 지나서, 지금 시작하면 구독 개월 수가 이어져요.</li>}
      <li>요금이 오르면 30일 전에 알리고 다시 동의를 받아요. 동의하지 않으면 자동 결제되지 않아요.</li>
    </ul>
  )
}

// 모바일 결제창에서 돌아왔을 때 (?pg=return): 서버에 빌링키를 넘겨 결제를 마무리하고 주소를 지운다
function usePayReturn() {
  const [params] = useSearchParams()
  const nav = useNavigate()
  const qc = useQueryClient()
  const done = useRef(false)
  useEffect(() => {
    if (params.get('pg') !== 'return' || done.current) return
    done.current = true
    nav('/membership', { replace: true })
    finishRedirect(params)
      .then(async (r) => { await qc.invalidateQueries({ queryKey: keys.membership }); toast(r === 'pending' ? '결제를 확인하고 있어요. 잠시 뒤 다시 열어 주세요.' : '멤버십을 시작했어요!') })
      .catch((e) => toast(errorText(e)))
  }, [params, nav, qc])
}

// 데모 전용: 구독 끝내기·초기화 (한도 넘침 표시 확인용)
function DemoTools({ m }: { m: M }) {
  const qc = useQueryClient()
  const me = useMe().data
  const { busy, run } = useRun()
  const act = (kind: 'end_sub' | 'clear') => run(async () => {
    await api.adminSetMembership(me!.id, kind)
    await qc.invalidateQueries({ queryKey: keys.membership })
  })
  return (
    <div className="mt-6 flex flex-wrap justify-center gap-2 px-5">
      {m.tier === 'subscriber' && <Button size="sm" variant="secondary" disabled={busy} onClick={() => act('end_sub')}>데모: 구독 끝내기</Button>}
      {m.tier !== 'free' || m.subUntil ? <Button size="sm" variant="secondary" disabled={busy} onClick={() => act('clear')}>데모: 초기화</Button> : null}
    </div>
  )
}
