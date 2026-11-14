import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api, type InquiryInput } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { Button, Chip } from '@/components/ui/Button'
import { Empty } from '@/components/ui/Empty'
import { TextArea } from '@/components/ui/Field'
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

// 문의: 설문으로 불편 요소를 받아 저장 → 운영자가 채팅(덕친소 운영팀)으로 답변, 답변 시 가입 메일로 알림
export default function Inquiry() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const me = useMe().data
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [body, setBody] = useState('')
  const { busy, run } = useRun()
  const ok = answers.category && body.trim().length >= 5

  const submit = async () => {
    if (!ok || busy) return
    return run(async () => {
      await api.submitInquiry({ category: answers.category as InquiryInput['category'], answers, body: body.trim() })
      await qc.invalidateQueries({ queryKey: keys.rooms })
      toast('문의를 보냈어요. 답변은 채팅 탭으로 와요.')
      nav('/chats')
    })
  }

  // 문의(운영팀 대화방)는 회원만 (서버 ensure_support_room·inquiries 정책도 막는다)
  if (me?.isGuest) return (<><AppHeader back title="문의" /><Empty title="문의는 회원만 보낼 수 있어요" body="회원으로 로그인한 뒤 다시 찾아 주세요." /></>)

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader back title="문의" />
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
          답변은 채팅 탭의 ‘덕친소 운영팀’ 대화방으로 보내 드려요.
          {me?.email ? ` 답변이 오면 ${me.email}로도 알려 드려요.` : ' 비회원은 메일 알림 없이 채팅으로만 답변을 받아요.'}
        </p>
      </div>
      <div className="px-5 pb-[max(24px,env(safe-area-inset-bottom))]">
        <Button block disabled={!ok || busy} onClick={submit}>{busy ? '보내는 중…' : '문의 보내기'}</Button>
      </div>
    </div>
  )
}
