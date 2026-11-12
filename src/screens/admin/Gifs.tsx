import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorText, type Gif } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { Button } from '@/components/ui/Button'
import { Empty } from '@/components/ui/Empty'
import { TextTabs } from '@/components/ui/TextTabs'
import { fmtRelative } from '@/lib/date'
import { toast } from '@/store/ui'
import { adminKeys } from './AdminGate'

// 공용 GIF 검토: 선정적·폭력적·저작권 문제 이미지는 거절. 승인한 것만 채팅 GIF 탭에 모두에게 보인다
export default function Gifs() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'pending' | 'done'>('pending')
  const [busy, setBusy] = useState<string | null>(null)
  const list = useQuery({ queryKey: adminKeys.gifs, queryFn: () => api.listGifs() })
  const shown = (list.data ?? []).filter((g) => (tab === 'pending') === (g.status === 'pending'))

  const resolve = async (g: Gif, approve: boolean) => {
    if (busy) return
    setBusy(g.id)
    try {
      await api.adminResolveGif(g.id, approve)
      await Promise.all([qc.invalidateQueries({ queryKey: adminKeys.gifs }), qc.invalidateQueries({ queryKey: ['gifs'] })])
      toast(approve ? '공개했어요' : '거절했어요')
    } catch (e) { toast(errorText(e)) } finally { setBusy(null) }
  }

  return (
    <>
      <AppHeader back title="GIF 검토" />
      <div className="border-b border-hairline">
        <TextTabs label="GIF 검토 상태" value={tab} onChange={setTab} tabs={[{ value: 'pending', label: '검토 대기' }, { value: 'done', label: '처리됨' }]} />
      </div>
      {shown.length ? (
        <ul className="grid grid-cols-2 gap-3 p-4 pb-8 md:grid-cols-3">
          {shown.map((g) => (
            <li key={g.id}>
              <img src={g.url} alt="검토할 GIF" className="aspect-square w-full rounded-lg bg-mist object-contain" />
              <p className="mt-1 t-cap text-graphite">{fmtRelative(g.createdAt)}{g.status !== 'pending' && ` · ${g.status === 'approved' ? '공개' : '거절'}`}</p>
              {g.status === 'pending' ? (
                <div className="mt-1.5 flex gap-2">
                  <Button size="md" disabled={!!busy} onClick={() => resolve(g, true)}>공개</Button>
                  <Button size="md" variant="secondary" disabled={!!busy} onClick={() => resolve(g, false)}>거절</Button>
                </div>
              ) : (
                <Button size="md" variant="secondary" disabled={!!busy} onClick={() => resolve(g, g.status !== 'approved')}>
                  {g.status === 'approved' ? '공개 내리기' : '다시 공개'}
                </Button>
              )}
            </li>
          ))}
        </ul>
      ) : <Empty title={list.isLoading ? '불러오는 중…' : tab === 'pending' ? '검토할 GIF 가 없어요' : '처리한 GIF 가 없어요'} />}
    </>
  )
}
