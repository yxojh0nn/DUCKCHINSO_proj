import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, type AdminInquiry } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { Empty } from '@/components/ui/Empty'
import { TextTabs } from '@/components/ui/TextTabs'
import { fmtRelative } from '@/lib/date'
import { INQUIRY_QUESTIONS } from '@/screens/my/Inquiry'
import { adminKeys } from './AdminGate'

// 설문 값 → 사용자가 고른 문구 (예: screen=chat → 채팅)
export const answerLabel = (key: string, value: string) =>
  INQUIRY_QUESTIONS.find((q) => q.key === key)?.options.find((o) => o.value === value)?.label ?? value
export const categoryLabel = (c: AdminInquiry['category']) => answerLabel('category', c)

// 문의: 답변 대기 / 답변 완료
export default function Inquiries() {
  const [tab, setTab] = useState<'open' | 'answered'>('open')
  const list = useQuery({ queryKey: adminKeys.inquiries, queryFn: () => api.adminInquiries() })
  const shown = (list.data ?? []).filter((i) => i.status === tab)
  return (
    <>
      <AppHeader back title="문의" />
      <div className="border-b border-hairline">
        <TextTabs label="문의 답변 상태" value={tab} onChange={setTab} tabs={[{ value: 'open', label: '답변 대기' }, { value: 'answered', label: '답변 완료' }]} />
      </div>
      {shown.length ? (
        <ul className="pb-8">
          {shown.map((i) => (
            <li key={i.id}>
              <Link to={`/admin/inquiries/${i.id}`} className="block px-5 py-3.5 active:bg-mist">
                <p className="flex items-center gap-2 t-sub">
                  <span className="font-semibold">{categoryLabel(i.category)}</span>
                  <span className="text-graphite">{i.user.nickname}{i.user.isGuest ? ' (비회원)' : ''} · {fmtRelative(i.createdAt)}</span>
                </p>
                <p className="mt-1 line-clamp-2 t-body">{i.body}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : <Empty title={list.isLoading ? '불러오는 중…' : tab === 'open' ? '답변할 문의가 없어요' : '답변한 문의가 없어요'} />}
    </>
  )
}
