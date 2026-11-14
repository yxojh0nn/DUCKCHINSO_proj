// 비어 있는 화면: 아이콘 + 한 줄 설명 + (선택) 다음 행동
export function Empty({ icon, title, body, action }: { icon?: React.ReactNode; title: string; body?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center px-8 py-16 text-center">
      {icon && <div className="mb-4 text-control-line">{icon}</div>}
      <p className="t-head">{title}</p>
      {body && <p className="mt-1.5 t-sub text-graphite">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
