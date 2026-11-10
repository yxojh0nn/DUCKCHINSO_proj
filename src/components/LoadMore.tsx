import { useEffect, useRef } from 'react'

// 목록 끝 표시: 화면에 들어오면(조금 전부터) 다음 목록을 부른다. 부르는 쪽은 key 에 지금 개수를 넣어
// 다음 목록이 붙을 때마다 다시 관찰하게 한다(여전히 보이면 또 부름). 버튼은 키보드·화면 읽기 사용자용
export function LoadMore({ onMore, loading }: { onMore: () => void; loading?: boolean }) {
  const ref = useRef<HTMLButtonElement>(null)
  const more = useRef(onMore)
  more.current = onMore
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((e) => e[0].isIntersecting && more.current(), { rootMargin: '300px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return (
    <button ref={ref} onClick={onMore} disabled={loading} className="flex h-12 w-full items-center justify-center t-sub text-graphite">
      {loading ? '불러오는 중…' : '더 보기'}
    </button>
  )
}
