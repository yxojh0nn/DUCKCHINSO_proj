import { useState } from 'react'
import { api, errorText, type ReportReason, type ReportTarget } from '@/api'
import { klipy } from '@/lib/klipy'
import { toast } from '@/store/ui'
import { Sheet } from './ui/Sheet'

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'abuse', label: '욕설·괴롭힘' },
  { value: 'sexual', label: '성희롱·불건전한 내용' },
  { value: 'scam', label: '사기·암표 거래' },
  { value: 'harmful_image', label: '불건전하거나 해로운 사진' },
  { value: 'spam', label: '스팸·홍보' },
  { value: 'etc', label: '기타' },
]

// KLIPY GIF 신고 사유 → KLIPY 신고 API 의 reason 값 (docs.klipy.com/gifs-api/gifs-report-api)
const GIF_REASONS: { value: ReportReason; label: string; klipy: string }[] = [
  { value: 'sexual', label: '선정적인 GIF', klipy: 'nudity' },
  { value: 'harmful_image', label: '폭력적인 GIF', klipy: 'violence' },
  { value: 'abuse', label: '혐오·괴롭힘', klipy: 'hate_speech' },
  { value: 'spam', label: '스팸·광고', klipy: 'spam' },
  { value: 'etc', label: '기타 불쾌한 GIF', klipy: 'offensive' },
]

// 신고 사유 고르기 → 접수. 운영자가 확인 후 삭제·제재한다.
// gif(KLIPY GIF 메시지)면 KLIPY 에도 신고해(콘텐츠 검토) 양쪽에서 처리한다. KLIPY 결과는 운영자가 보도록 detail 에 남긴다
export function ReportSheet({ target, open, onClose, onDone, gif }: {
  target: ReportTarget; open: boolean; onClose: () => void; onDone?: () => void; gif?: { slug: string; customerId: string }
}) {
  const [busy, setBusy] = useState(false)
  const submit = async (reason: ReportReason) => {
    if (busy) return
    setBusy(true)
    try {
      let detail: string | undefined
      if (gif) {
        const k = GIF_REASONS.find((r) => r.value === reason)!.klipy
        const sent = await klipy.report(gif.slug, gif.customerId, k).then(() => true, () => false)
        detail = `KLIPY GIF ${gif.slug} · KLIPY 신고 ${sent ? `접수(${k})` : '실패: 파트너 관리 화면에서 직접 막아 주세요'}`
      }
      await api.report(target, reason, detail)
      toast(gif ? 'KLIPY 와 운영팀에 신고했어요.' : '신고가 접수됐어요. 운영팀이 확인할게요.')
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
      actions={(gif ? GIF_REASONS : REPORT_REASONS).map((r) => ({ label: r.label, onClick: () => submit(r.value), danger: true }))} />
  )
}
