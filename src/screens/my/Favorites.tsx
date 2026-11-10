import { useQueryClient } from '@tanstack/react-query'
import { api, errorText } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { ConcertRow } from '@/components/ConcertRow'
import { IconTicket } from '@/components/icons'
import { Empty } from '@/components/ui/Empty'
import { kstDayKey } from '@/lib/date'
import { keys, useConcerts, useMe } from '@/lib/queries'
import { toast } from '@/store/ui'

// 관심 공연 관리: 다가오는 공연 / 다녀온 공연, 행마다 빼기
export default function Favorites() {
  const qc = useQueryClient()
  const me = useMe().data
  const concerts = useConcerts().data ?? []
  const today = kstDayKey(Date.now())
  const favs = concerts.filter((c) => me?.favoriteIds.includes(c.id))
  const upcoming = favs.filter((c) => c.schedules.some((s) => kstDayKey(s) >= today))
  const past = favs.filter((c) => !upcoming.includes(c))

  const remove = async (id: string) => {
    try { await api.setFavorite(id, false); await qc.invalidateQueries({ queryKey: keys.me }); toast('관심 공연에서 뺐어요') } catch (e) { toast(errorText(e)) }
  }
  const section = (title: string, list: typeof favs) => list.length > 0 && (
    <section className="mt-4">
      <h2 className="px-5 pb-1 t-sub font-semibold text-graphite">{title}</h2>
      <ul>
        {list.map((c) => (
          <ConcertRow key={c.id} concert={c}
            right={<button onClick={() => remove(c.id)} className="h-9 px-2 t-sub text-graphite">빼기</button>} />
        ))}
      </ul>
    </section>
  )
  return (
    <>
      <AppHeader back title="관심 공연" />
      {favs.length ? <>{section('다가오는 공연', upcoming)}{section('다녀온 공연', past)}</>
        : <Empty icon={<IconTicket size={44} />} title="관심 공연이 없어요" body="공연 상세에서 티켓 모양 버튼을 누르면 담기고, 캘린더에 강조돼요." />}
    </>
  )
}
