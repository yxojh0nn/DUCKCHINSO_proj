import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorText, type AdminInquiry } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { Button } from '@/components/ui/Button'
import { Confirm } from '@/components/ui/Confirm'
import { Empty } from '@/components/ui/Empty'
import { TextArea } from '@/components/ui/Field'
import { fmtDateTime } from '@/lib/date'
import { INQUIRY_QUESTIONS } from '@/screens/my/Inquiry'
import { toast } from '@/store/ui'
import { adminKeys } from './AdminGate'
import { answerLabel, categoryLabel } from './Inquiries'

// 문의 한 건: 설문·본문 확인 → 답변. 답변은 사용자의 운영팀 대화방으로 가고, 회원에게는 메일로도 알린다(answer-inquiry 함수)
export default function InquiryDetail() {
  const { id = '' } = useParams()
  const list = useQuery({ queryKey: adminKeys.inquiries, queryFn: () => api.adminInquiries() })
  const i = list.data?.find((x) => x.id === id)
  if (!i) return <><AppHeader back title="문의" />{list.isFetched && <Empty title="문의를 찾을 수 없어요" />}</>
  return <InquiryForm i={i} />
}

function InquiryForm({ i }: { i: AdminInquiry }) {
  const nav = useNavigate()
  const qc = useQueryClient()
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [del, setDel] = useState(false)
  // 답변 완료 문의 삭제: 사용자 대화방의 답변 메시지는 남는다. 누가 지웠는지는 운영 기록에 남는다
  const remove = async () => {
    setDel(false)
    try {
      await api.adminDeleteInquiry(i.id)
      await qc.invalidateQueries({ queryKey: adminKeys.inquiries })
      toast('문의를 삭제했어요')
      nav('/admin/inquiries', { replace: true })
    } catch (e) { toast(errorText(e)) }
  }
  const send = async () => {
    if (!answer.trim() || busy) return
    setBusy(true)
    try {
      const { mailed } = await api.adminAnswerInquiry(i.id, answer.trim())
      await qc.invalidateQueries({ queryKey: ['admin'] })
      toast(mailed ? '답변을 보내고 메일로 알렸어요' : '답변을 운영팀 대화방으로 보냈어요 (메일 알림은 보내지 않았어요)')
      nav('/admin/inquiries', { replace: true })
    } catch (e) { toast(errorText(e)) } finally { setBusy(false) }
  }
  const survey = INQUIRY_QUESTIONS.filter((q) => q.key !== 'category' && i.answers[q.key])

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader back title="문의" />
      <section className="px-5 pt-2">
        <p className="t-sub text-graphite">{i.user.nickname}{i.user.isGuest ? ' (비회원)' : ''} · {fmtDateTime(i.createdAt)}</p>
        <h1 className="mt-1 t-title">{categoryLabel(i.category)}</h1>
        {survey.length > 0 && (
          <dl className="mt-3 space-y-1 t-sub">
            {survey.map((q) => (
              <div key={q.key} className="flex gap-3"><dt className="shrink-0 text-graphite">{q.title}</dt><dd>{answerLabel(q.key, i.answers[q.key])}</dd></div>
            ))}
          </dl>
        )}
        <p className="mt-4 whitespace-pre-wrap break-words t-body">{i.body}</p>
      </section>

      {i.status === 'answered' ? (
        <section className="mt-6 border-t border-hairline px-5 pt-5">
          <p className="t-sub text-graphite">보낸 답변{i.answeredAt ? ` · ${fmtDateTime(i.answeredAt)}` : ''}</p>
          <p className="mt-1 whitespace-pre-wrap break-words t-body">{i.answer}</p>
          <Button block variant="secondary" className="mt-8" onClick={() => setDel(true)}>문의 삭제</Button>
          <Confirm open={del} title="이 문의를 삭제할까요?" message="운영자 문의 목록에서 지워지고 되돌릴 수 없어요. 사용자의 운영팀 대화방에 보낸 답변은 그대로 남아요."
            confirmLabel="삭제" danger onClose={() => setDel(false)} onConfirm={remove} />
        </section>
      ) : (
        <section className="mt-6 flex flex-1 flex-col border-t border-hairline px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-5">
          <TextArea label="답변" rows={6} maxLength={2000} value={answer} onChange={(e) => setAnswer(e.target.value)}
            hint={i.user.isGuest ? '운영팀 대화방으로 보내요. 비회원은 메일이 가지 않아요.' : '운영팀 대화방으로 보내요. 메일 발송 키(RESEND_API_KEY)를 등록했다면 가입 메일로도 알려요.'} />
          <Button block className="mt-auto" disabled={!answer.trim() || busy} onClick={send}>{busy ? '보내는 중…' : '답변 보내기'}</Button>
        </section>
      )}
    </div>
  )
}
