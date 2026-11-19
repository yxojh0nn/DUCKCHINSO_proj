import { useEffect, useState } from 'react'
import type { Recap } from '@/lib/recap'
import { periodLabel } from '@/lib/recap'
import { recapPreview, type RecapCardOpts } from '@/lib/recapImage'

// 리캡 카드 미리보기: 저장되는 이미지와 같은 그림 (화면용은 JPEG, 한 번 그린 카드는 캐시)
// bare: 바탕·모서리 없이 그림만 (서랍에서 커진 카드처럼 바깥이 이미 카드 모양일 때)
export function RecapCard({ recap, opts, bare }: { recap: Recap; opts: RecapCardOpts; bare?: boolean }) {
  const [url, setUrl] = useState<string | null>(null)
  const key = JSON.stringify([recap, opts])
  useEffect(() => {
    let alive = true
    let made: string | null = null
    recapPreview(recap, opts).then((blob) => { // 같은 카드는 캐시에서 바로
      if (!alive) return
      made = URL.createObjectURL(blob)
      setUrl(made)
    }).catch(() => {})
    return () => { alive = false; if (made) URL.revokeObjectURL(made) }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 내용(key)이 바뀔 때만 다시 그린다
  }, [key])
  const titles = recap.items.map((i) => i.title).join(', ')
  return (
    <div className={`aspect-[9/16] w-full overflow-hidden ${bare ? '' : 'rounded-[20px] border border-hairline bg-mist'}`}>
      {url && <img src={url} alt={`${periodLabel(recap.period)} 리캡 카드. ${opts.nickname}, 다녀온 공연 ${recap.items.length}개: ${titles}`} className="h-full w-full" />}
    </div>
  )
}
