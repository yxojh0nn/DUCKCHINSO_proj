import type { Message } from '@/store/useAppStore'
import { fmtTime } from '@/lib/date'

export function MessageBubble({ m }: { m: Message }) {
  if (m.from === 'system') {
    return <p className="mx-auto my-2 max-w-[85%] rounded-lg bg-chip px-3 py-1.5 text-center text-xs text-muted">{m.text}</p>
  }
  const mine = m.from === 'me'
  return (
    <div className={`my-1 flex items-end gap-1.5 ${mine ? 'flex-row-reverse' : ''}`}>
      <p className={`max-w-[72%] rounded-2xl px-3 py-2 text-sm ${mine ? 'rounded-br-md bg-accent text-white' : 'rounded-bl-md bg-surface border border-line'}`}>{m.text}</p>
      <span className="text-[10px] text-muted">{fmtTime(m.at)}</span>
    </div>
  )
}
