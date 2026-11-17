import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type InquiryInput, type MyInquiry } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { Button, Chip } from '@/components/ui/Button'
import { Checkbox } from '@/components/ui/Checkbox'
import { Empty } from '@/components/ui/Empty'
import { TextArea } from '@/components/ui/Field'
import { TextTabs } from '@/components/ui/TextTabs'
import { fmtDateTime } from '@/lib/date'
import { keys, useMe } from '@/lib/queries'
import { toast } from '@/store/ui'
import { useRun } from '@/lib/actions'

type Q = { key: string; title: string; options: { value: string; label: string }[] }

export const INQUIRY_QUESTIONS: Q[] = [
  { key: 'category', title: '어떤 점이 불편했나요?', options: [
    { value: 'bug', label: '오류·버그' }, { value: 'concert_info', label: '공연 정보가 틀리거나 없음' },
    { value: 'account', label: '로그인·계정' }, { value: 'report', label: '다른 이용자 신고' },
    { value: 'suggestion', label: '기능 제안' }, { value: 'etc', label: '기타' },
  ] },
  { key: 'screen', title: '어느 화면에서 겪었나요?', options: [
    { value: 'calendar', label: '공연·캘린더' }, { value: 'community', label: '커뮤니티' },
    { value: 'chat', label: '채팅' }, { value: 'my', label: 'MY' }, { value: 'etc', label: '잘 모르겠어요' },
  ] },
  { key: 'frequency', title: '얼마나 자주 겪나요?', options: [
    { value: 'once', label: '한 번' }, { value: 'sometimes', label: '가끔' }, { value: 'always', label: '매번' },
  ] },
]

const categoryText = (c: string) => INQUIRY_QUESTIONS[0].options.find((o) => o.value === c)?.label ?? c

// 문의: 문의 작성 | 문의 내역. 운영자 답변은 문의 내역에서 보고, 답변 시 가입 메일로도 알린다(answer-inquiry 함수)
export default function Inquiry() {
  const me = useMe().data
  const [tab, setTab] = useState<'write' | 'list'>('write')

  // 문의는 회원만 (서버 inquiries 정책도 막는다)
  if (me?.isGuest) return (<><AppHeader back title="문의" /><Empty title="문의는 회원만 보낼 수 있어요" body="회원으로 로그인한 뒤 다시 찾아 주세요." /></>)

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader back title="문의" />
      <div className="border-b border-hairline">
        <TextTabs label="문의" value={tab} onChange={setTab} tabs={[{ value: 'write', label: '문의 작성' }, { value: 'list', label: '문의 내역' }]} />
      </div>
      {tab === 'write' ? <WriteForm email={me?.email ?? null} onSent={() => setTab('list')} /> : <InquiryList />}
    </div>
  )
}

function InquiryList() {
  const list = useQuery({ queryKey: keys.inquiries, queryFn: () => api.myInquiries() })
  const [answeredOnly, setAnsweredOnly] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const rows = (list.data ?? []).filter((i) => !answeredOnly || i.status === 'answered')
  return (
    <>
      <div className="px-5 pt-1">
        <Checkbox checked={answeredOnly} onChange={setAnsweredOnly}>답변 완료만 보기</Checkbox>
      </div>
      {rows.length ? (
        <ul className="pb-8">
          {rows.map((i) => <InquiryRow key={i.id} i={i} open={open === i.id} onToggle={() => setOpen(open === i.id ? null : i.id)} />)}
        </ul>
      ) : <Empty title={list.isLoading ? '불러오는 중…' : list.isError ? '불러오지 못했어요' : answeredOnly ? '답변 완료된 문의가 없어요' : '보낸 문의가 없어요'} />}
      {!!list.data?.length && <p className="px-5 pb-8 t-cap text-graphite">답변을 받은 문의는 1년이 지나면 정리돼요.</p>}
    </>
  )
}

function InquiryRow({ i, open, onToggle }: { i: MyInquiry; open: boolean; onToggle: () => void }) {
  const done = i.status === 'answered'
  return (
    <li className="border-b border-hairline">
      <button onClick={onToggle} aria-expanded={open} className="block w-full px-5 py-3.5 text-left active:bg-mist">
        <span className="flex items-center justify-between gap-3">
          <span className="t-body font-semibold">{categoryText(i.category)}</span>
          <span className={`shrink-0 t-cap font-semibold ${done ? 'text-ink' : 'text-graphite'}`}>{done ? '답변 완료' : '답변 대기'}</span>
        </span>
        <span className={`mt-1 block t-sub text-graphite ${open ? 'whitespace-pre-wrap break-words' : 'truncate'}`}>{i.body}</span>
        <span className="mt-1 block t-cap text-graphite num">{fmtDateTime(i.createdAt)}</span>
      </button>
      {open && done && (
        <div className="mx-5 mb-4 rounded-[12px] bg-mist px-4 py-3">
          <p className="t-cap text-graphite">덕친소 운영팀 답변{i.answeredAt ? ` · ${fmtDateTime(i.answeredAt)}` : ''}</p>
          <p className="mt-1 whitespace-pre-wrap break-words t-body">{i.answer}</p>
        </div>
      )}
    </li>
  )
}

function WriteForm({ email, onSent }: { email: string | null; onSent: () => void }) {
  const qc = useQueryClient()
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [body, setBody] = useState('')
  const { busy, run } = useRun()
  const ok = answers.category && body.trim().length >= 5

  const submit = async () => {
    if (!ok || busy) return
    return run(async () => {
      await api.submitInquiry({ category: answers.category as InquiryInput['category'], answers, body: body.trim() })
      await qc.invalidateQueries({ queryKey: keys.inquiries })
      toast('문의를 보냈어요. 답변은 문의 내역에서 볼 수 있어요.')
      onSent()
    })
  }

  return (
    <>
      <div className="flex-1 px-5 pb-6">
        {INQUIRY_QUESTIONS.map((q) => (
          <fieldset key={q.key} className="mt-5 first:mt-2">
            <legend className="t-head">{q.title}</legend>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {q.options.map((o) => {
                const on = answers[q.key] === o.value
                return (
                  <Chip key={o.value} on={on} onClick={() => setAnswers({ ...answers, [q.key]: o.value })}>{o.label}</Chip>
                )
              })}
            </div>
          </fieldset>
        ))}
        <TextArea className="mt-7" label="자세한 내용" rows={5} maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)}
          placeholder="언제, 무엇을 하다가 어떤 일이 있었는지 적어 주세요." hint={`${body.length}/2000`} />
        <p className="mt-5 t-sub text-graphite">
          답변은 ‘문의 내역’에서 볼 수 있어요.
          {email ? ` 답변이 오면 ${email}로도 알려 드려요.` : ''}
        </p>
      </div>
      <div className="px-5 pb-[max(24px,env(safe-area-inset-bottom))]">
        <Button block disabled={!ok || busy} onClick={submit}>{busy ? '보내는 중…' : '문의 보내기'}</Button>
      </div>
    </>
  )
}
