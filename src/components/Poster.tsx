import { colorOf } from '@/lib/calendar'

// 공연 포스터. 이미지가 없으면 공연 색 + 제목으로 대신 그린다
export function Poster({ id, url, title, className = '' }: { id: string; url: string | null; title: string; className?: string }) {
  if (url) return <img src={url} alt={`${title} 포스터`} loading="lazy" className={`bg-mist object-cover ${className}`} />
  return (
    <div aria-hidden className={`flex items-end overflow-hidden p-2 ${className}`} style={{ background: colorOf(id) }}>
      <span className="line-clamp-3 text-[11px] font-bold leading-tight text-white/95">{title}</span>
    </div>
  )
}
