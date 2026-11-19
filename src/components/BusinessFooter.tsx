import { Link } from 'react-router-dom'
import { BUSINESS } from '@/data/business'

// 사이트 하단 사업자 정보 (전자상거래법 표시 의무) + 약관·방침 링크
export function BusinessFooter({ className = '' }: { className?: string }) {
  const b = BUSINESS
  return (
    <footer className={`t-cap text-graphite ${className}`}>
      <nav aria-label="약관과 정책" className="flex flex-wrap gap-x-3 gap-y-1">
        <Link to="/legal/terms" className="underline underline-offset-2">이용약관</Link>
        <Link to="/legal/privacy" className="font-semibold underline underline-offset-2">개인정보처리방침</Link>
        <Link to="/legal/refund" className="underline underline-offset-2">환불 정책</Link>
        <Link to="/legal/membership" className="underline underline-offset-2">멤버십 안내</Link>
      </nav>
      <p className="mt-2 leading-relaxed">
        상호 {b.name} · 대표자 {b.owner} · 사업자등록번호 {b.bizNo}<br />
        주소 {b.address}<br />
        전화 <a href={`tel:${b.phone}`}>{b.phone}</a> · 이메일 <a href={`mailto:${b.email}`}>{b.email}</a>
      </p>
    </footer>
  )
}
