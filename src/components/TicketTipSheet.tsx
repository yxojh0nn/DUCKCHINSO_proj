import { useState } from 'react'
import { api, errorText } from '@/api'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/Field'
import { Sheet } from '@/components/ui/Sheet'
import { toast } from '@/store/ui'

// 예매 오픈일 제보: 공식 공지를 본 회원이 날짜와 출처 링크를 보내면 운영자가 확인해 반영한다
// (예매처 사이트는 약관·봇 차단 때문에 자동 수집하지 않는다)
export function TicketTipSheet({ open, onClose, concertId }: { open: boolean; onClose: () => void; concertId: string }) {
  const [at, setAt] = useState('') // datetime-local 값 (이 기기 시간대 = 한국)
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const urlOk = /^https?:\/\/\S+$/.test(url)
  const ok = !!at && urlOk

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ok || busy) return
    setBusy(true)
    try {
      await api.submitTicketTip(concertId, new Date(at).toISOString(), url)
      toast('제보를 보냈어요. 운영자가 확인한 뒤 반영돼요.')
      setAt(''); setUrl(''); onClose()
    } catch (err) { toast(errorText(err)) } finally { setBusy(false) }
  }

  return (
    <Sheet open={open} onClose={onClose} title="예매 오픈일 알려 주기" message="공식 공지에서 본 날짜와 그 공지 링크를 알려 주세요.">
      <form onSubmit={submit} className="px-5 pb-5 pt-2">
        <label className="block t-sub font-semibold text-graphite" htmlFor="tip-at">예매 오픈 일시</label>
        <input id="tip-at" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)}
          className="mt-1 block h-11 w-full border-b border-hairline outline-none t-body focus:border-ink" />
        <TextField className="mt-5" label="공지 링크" type="url" inputMode="url" placeholder="https://" value={url}
          onChange={(e) => setUrl(e.target.value.trim())} maxLength={500}
          error={url && !urlOk ? 'https:// 로 시작하는 주소를 넣어 주세요.' : undefined}
          hint="예매처 공지, 기획사 공지·SNS 등 날짜가 나온 곳" />
        <Button type="submit" block className="mt-6" disabled={!ok || busy}>{busy ? '보내는 중…' : '제보하기'}</Button>
      </form>
    </Sheet>
  )
}
