// iOS 목록: 카드 대신 얇은 구분선으로 나뉜 행. 구분선은 왼쪽 여백(inset)만큼 들여서 시작한다
export function List({ header, footer, children }: { header?: string; footer?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mt-7 first:mt-2">
      {header && <h2 className="px-5 pb-1.5 t-sub font-semibold text-graphite">{header}</h2>}
      <ul className="border-y border-hairline/70">{children}</ul>
      {footer && <p className="px-5 pt-2 t-sub text-graphite">{footer}</p>}
    </section>
  )
}

type RowProps = { children: React.ReactNode; inset?: number; className?: string }

export function Row({ children, inset = 20, className = '' }: RowProps) {
  return (
    <li className="group relative">
      <div className={`flex min-h-11 items-center gap-3 px-5 py-2.5 ${className}`}>{children}</div>
      <span aria-hidden className="absolute bottom-0 right-0 h-px bg-hairline/70 group-last:hidden" style={{ left: inset }} />
    </li>
  )
}

export const Chevron = () => (
  <svg aria-hidden viewBox="0 0 8 14" className="h-3 w-2 shrink-0 text-hairline" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 1l6 6-6 6" /></svg>
)
