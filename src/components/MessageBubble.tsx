import type { Message } from '@/store/useAppStore'
import { fmtTime } from '@/lib/date'

export function MessageBubble({ m }: { m: Message }) {
  if (m.from === 'system') {
    return <p className="mx-auto my-4 max-w-[80%] text-center t-cap text-graphite">{m.text}</p>
  }
  const mine = m.from === 'me'
  return (
    <div className={`my-0.5 flex items-end gap-1.5 ${mine ? 'flex-row-reverse' : ''}`}>
      <p className={`max-w-[72%] rounded-[18px] px-3.5 py-2 t-body ${mine ? 'bg-ink text-paper' : 'bg-mist text-ink'}`}>{m.text}</p>
      <span className="pb-0.5 text-[10px] text-graphite num">{fmtTime(m.at)}</span>
    </div>
  )
}
