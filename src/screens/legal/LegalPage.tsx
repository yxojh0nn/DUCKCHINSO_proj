import { Navigate, useParams } from 'react-router-dom'
import { AppHeader } from '@/components/AppHeader'
import { ConsentBody } from '@/components/ConsentList'
import { BusinessFooter } from '@/components/BusinessFooter'
import { COMMUNITY_RULES, CONSENT_ITEMS, CONSENT_VERSION } from '@/data/consent'
import { BENEFITS, BUSINESS, MEMBERSHIP_PRODUCT, REFUND_POLICY } from '@/data/business'
import { won } from '@/lib/payment'

// 로그인 없이 열리는 공개 문서. 스토어 등록에 필요한 주소:
// /legal/privacy (개인정보처리방침, 두 스토어 필수) · /legal/terms (이용약관) · /legal/delete-account (Google Play 계정 삭제 안내 URL)
// /legal/refund (환불 정책) · /legal/membership (상품 안내): PG 심사(상품·가격·환불 공개)용
// 문안은 consent.ts 와 같은 원본을 쓴다 (동의 화면과 내용이 갈라지지 않게). 법률 검토 전 초안
const DOCS = {
  privacy: { title: '개인정보처리방침', items: ['privacy', 'push', 'marketing', 'nightMarketing'] },
  terms: { title: '이용약관', items: ['age14', 'terms', 'policy'] },
} as const

export default function LegalPage() {
  const { doc = '' } = useParams()
  if (doc === 'delete-account') return <DeleteAccount />
  if (doc === 'refund') return <Refund />
  if (doc === 'membership') return <Product />
  const d = DOCS[doc as keyof typeof DOCS]
  if (!d) return <Navigate to="/" replace />
  return (
    <div className="mx-auto max-w-[720px] pb-12">
      <AppHeader title={d.title} />
      <p className="px-5 t-cap text-graphite num">시행일 {CONSENT_VERSION} · 덕친소</p>
      {d.items.map((key) => {
        const item = CONSENT_ITEMS.find((c) => c.key === key)!
        return (
          <section key={key} className="mt-6 px-5">
            <h2 className="t-head">{item.label.replace(' (선택)', '')}</h2>
            <div className="-ml-9 mt-2"><ConsentBody item={item} /></div>
          </section>
        )
      })}
      {doc === 'terms' && (
        <section className="mt-6 px-5">
          <h2 className="t-head">커뮤니티 이용 규약</h2>
          <ol className="mt-2 space-y-3">
            {COMMUNITY_RULES.map((r, i) => (
              <li key={r.title} className="t-sub"><span className="font-semibold">{i + 1}. {r.title}</span><br /><span className="text-graphite">{r.body}</span></li>
            ))}
          </ol>
        </section>
      )}
      {doc === 'terms' && (
        <section className="mt-6 px-5">
          <h2 className="t-head">유료 서비스 (멤버십)</h2>
          <p className="mt-2 t-sub text-graphite">{MEMBERSHIP_PRODUCT.name}은 매월 같은 날 자동 결제되는 정기결제 상품입니다. 요금은 월 {won(MEMBERSHIP_PRODUCT.priceKrw)}이며, 처음 구독하는 회원은 첫 달 {won(MEMBERSHIP_PRODUCT.firstPriceKrw)}입니다. 결제 전에 금액·결제일·해지 방법·환불 조건을 알리고 동의를 받습니다.</p>
          <h3 className="mt-4 t-body font-semibold">취소·환불·청약철회</h3>
          <RefundList />
        </section>
      )}
      {doc === 'privacy' && (
        <section className="mt-6 px-5 t-sub text-graphite">
          <h2 className="t-head text-ink">파기와 문의</h2>
          <p className="mt-2">회원탈퇴하면 계정과 연결된 정보(프로필, 관심 아티스트, 글, 댓글, 채팅, 사진)를 지체 없이 지웁니다. 신고·제재 기록은 법령에 따라 사용자와의 연결을 끊고 1년간 보관합니다.</p>
          <h2 className="mt-6 t-head text-ink">외부 서비스</h2>
          <p className="mt-2">채팅의 GIF 검색·전송은 KLIPY(GIF 제공 서비스)를 이용합니다. GIF 를 찾거나 보낼 때 이용자 기기가 KLIPY 에 직접 접속하므로 IP 주소·기기 정보와, 회원 ID 를 알아볼 수 없게 바꾼 식별값·검색어·신고 사유가 KLIPY 에 전달됩니다. 이 정보는 GIF 제공, 최근 보낸 GIF 목록, 부적절한 GIF 신고 처리에 쓰입니다.</p>
          <h2 className="mt-6 t-head text-ink">결제 정보</h2>
          <p className="mt-2">멤버십 결제는 결제대행사(포트원과 이용자가 고른 카드사·간편결제사)가 처리합니다. 덕친소는 카드번호를 받거나 저장하지 않고, 결제대행사가 발급한 정기결제용 식별값, 결제 수단 이름(예: 카드사명), 결제·환불 기록만 보관합니다. 결제 기록은 전자상거래법에 따라 5년간 보관합니다.</p>
          <h2 className="mt-6 t-head text-ink">개인정보 보호책임자</h2>
          <p className="mt-2">{BUSINESS.owner} ({BUSINESS.email}, {BUSINESS.phone})</p>
          <p className="mt-2">개인정보 관련 문의는 앱의 MY &gt; 문의 또는 위 연락처로 보내 주세요.</p>
        </section>
      )}
      <BusinessFooter className="mt-10 border-t border-hairline px-5 pt-5" />
    </div>
  )
}

// Google Play 정책: 앱 밖에서도 계정 삭제 방법을 볼 수 있는 웹 주소가 필요하다
function DeleteAccount() {
  return (
    <div className="mx-auto max-w-[720px] pb-12">
      <AppHeader title="계정 삭제 안내" />
      <section className="px-5 t-body">
        <p>덕친소 계정은 앱에서 바로 지울 수 있어요.</p>
        <ol className="mt-4 list-decimal space-y-1.5 pl-5">
          <li>덕친소 앱을 열고 MY 탭으로 이동합니다.</li>
          <li>맨 아래 <b>회원탈퇴</b>를 누릅니다.</li>
          <li>지워지는 정보를 확인하고 탈퇴를 확정합니다.</li>
        </ol>
        <h2 className="mt-8 t-head">지워지는 정보</h2>
        <p className="mt-2 t-sub text-graphite">계정, 프로필·배너 사진, 관심 아티스트·장르·공연, 친구·차단 목록, 글·댓글·추천, 채팅 메시지와 사진, 동의 기록, 문의 내용. 탈퇴 즉시 삭제되며 되돌릴 수 없습니다.</p>
        <h2 className="mt-6 t-head">남는 정보</h2>
        <p className="mt-2 t-sub text-graphite">다른 이용자가 신고한 내용과 제재 기록은 분쟁 대응을 위해 사용자와의 연결을 끊은 상태로 1년간 보관한 뒤 지웁니다.</p>
        <p className="mt-6 t-sub text-graphite">앱을 쓸 수 없는 경우 앱의 MY &gt; 문의 또는 운영팀에 계정 삭제를 요청할 수 있어요. 비회원(익명) 계정은 마지막 접속 후 180일이 지나면 자동으로 지워집니다.</p>
      </section>
      <BusinessFooter className="mt-10 border-t border-hairline px-5 pt-5" />
    </div>
  )
}

function RefundList() {
  return (
    <ol className="mt-3 space-y-3">
      {REFUND_POLICY.map((r, i) => (
        <li key={r.title} className="t-sub"><span className="font-semibold">{i + 1}. {r.title}</span><br /><span className="text-graphite">{r.body}</span></li>
      ))}
    </ol>
  )
}

function Refund() {
  return (
    <div className="mx-auto max-w-[720px] pb-12">
      <AppHeader title="환불 정책" />
      <p className="px-5 t-cap text-graphite num">시행일 {CONSENT_VERSION} · 덕친소</p>
      <section className="mt-4 px-5">
        <p className="t-sub text-graphite">{MEMBERSHIP_PRODUCT.name}의 취소·환불·청약철회 기준입니다. 전자상거래 등에서의 소비자보호에 관한 법률을 따릅니다.</p>
        <RefundList />
      </section>
      <BusinessFooter className="mt-10 border-t border-hairline px-5 pt-5" />
    </div>
  )
}

// 로그인 없이 보는 상품 안내: 상품명·가격·제공 내용·결제 방식·환불
function Product() {
  const p = MEMBERSHIP_PRODUCT
  return (
    <div className="mx-auto max-w-[720px] pb-12">
      <AppHeader title="멤버십 안내" />
      <section className="px-5">
        <h2 className="t-title">{p.name}</h2>
        <p className="mt-2 t-head num">월 {won(p.priceKrw)} <span className="t-sub font-medium text-graphite">(처음 구독하면 첫 달 {won(p.firstPriceKrw)})</span></p>
        <p className="mt-2 t-sub text-graphite">카드·간편결제로 매월 첫 결제일과 같은 날(그 날짜가 없는 달은 말일) 자동 결제됩니다. 결제 즉시 앱에서 혜택이 열리며, 언제든 앱에서 해지할 수 있습니다.</p>
        <h3 className="mt-6 t-head">제공 내용</h3>
        <ul className="mt-2 divide-y divide-hairline">
          {BENEFITS.map((b) => (
            <li key={b.title} className="py-3"><p className="t-body font-semibold">{b.title}</p><p className="mt-0.5 t-sub text-graphite">{b.body}</p></li>
          ))}
        </ul>
        <h3 className="mt-6 t-head">취소·환불</h3>
        <RefundList />
      </section>
      <BusinessFooter className="mt-10 border-t border-hairline px-5 pt-5" />
    </div>
  )
}
