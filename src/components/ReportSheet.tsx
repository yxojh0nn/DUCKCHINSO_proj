import { useState } from 'react'
import { api, errorText, type ReportReason, type ReportTarget } from '@/api'
import { toast } from '@/store/ui'
import { Sheet } from './ui/Sheet'

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'abuse', label: '욕설·괴롭힘' },
  { value: 'sexual', label: '성희롱·불건전한 내용' },
  { value: 'scam', label: '사기·암표 거래' },
  { value: 'harmful_image', label: '불건전하거나 해로운 사진' },
  { value: 'spam', label: '스팸·홍보' },
  { value: 'etc', label: '기타' },
]

// 신고 사유 고르기 → 접수. 운영자가 확인 후 삭제·제재한다
export function ReportSheet({ target, open, onClose, onDone }: { target: ReportTarget; open: boolean; onClose: () => void; onDone?: () => void }) {
  const [busy, setBusy] = useState(false)
  const submit = async (reason: ReportReason) => {
    if (busy) return
    setBusy(true)
    try {
      await api.report(target, reason)
      toast('신고가 접수됐어요. 운영팀이 확인할게요.')
      onDone?.()
    } catch (e) {
      toast(errorText(e))
    } finally {
      setBusy(false)
      onClose()
    }
  }
  return (
    <Sheet open={open} onClose={onClose} title="신고 사유를 골라 주세요" message="신고한 사실은 상대에게 알리지 않아요."
      actions={REASONS.map((r) => ({ label: r.label, onClick: () => submit(r.value), danger: true }))} />
  )
}
