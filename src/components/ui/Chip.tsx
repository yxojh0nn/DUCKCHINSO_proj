// 작은 상태 표시. 색보다 글자로 상태를 말한다 (디자인 기획안 원칙 2)
export function Tag({ children, tone = 'plain' }: { children: React.ReactNode; tone?: 'plain' | 'rose' | 'azure' }) {
  const t = {
    plain: 'text-graphite',
    rose: 'text-rose',
    azure: 'text-azure',
  }[tone]
  return <span className={`t-cap ${t}`}>{children}</span>
}
