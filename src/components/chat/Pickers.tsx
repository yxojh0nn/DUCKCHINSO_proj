import { useEffect, useState } from 'react'
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { LoadMore } from '@/components/LoadMore'
import { IconClose } from '@/components/icons'
import { TextTabs } from '@/components/ui/TextTabs'
import { klipy, type KlipyGif } from '@/lib/klipy'
import { toast } from '@/store/ui'

const EMOJIS = '😀 😂 🥹 😊 😍 🥰 😘 😎 🤩 🥳 😭 😢 😡 😱 🤔 🙄 😴 🤗 🙏 👍 👎 👏 🙌 💪 👋 🤞 ❤️ 🧡 💛 💚 💙 💜 🖤 💔 🔥 ✨ 🎉 🎶 🎤 🎸 🥁 🎧 📸 🍀 🌸 ⭐ 💯 👀'.split(' ')

// 이모지 고르기: 누르면 입력칸에 넣는다
export function EmojiPicker({ onEmoji }: { onEmoji: (e: string) => void }) {
  return (
    <div className="h-56 overflow-y-auto border-t border-hairline bg-paper p-3">
      <div className="grid grid-cols-8 gap-1">
        {EMOJIS.map((e) => (
          <button key={e} type="button" onClick={() => onEmoji(e)} aria-label={e} className="h-10 rounded-lg text-[24px] hover:bg-mist active:bg-mist">{e}</button>
        ))}
      </div>
    </div>
  )
}

// KLIPY GIF: 검색 · 인기 · 최근 보낸 GIF. 누르면 바로 보낸다.
// KLIPY 규칙: 검색칸 안내 문구는 'Search KLIPY'(필수), 결과는 받은 순서 그대로, 다른 GIF 와 섞지 않는다
export function GifPicker({ cid, busy, onPick }: { cid: string; busy: boolean; onPick: (g: KlipyGif, q: string) => void }) {
  const qc = useQueryClient()
  const [input, setInput] = useState('')
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<'trending' | 'recent'>('trending')
  useEffect(() => { const t = window.setTimeout(() => setQ(input.trim()), 300); return () => window.clearTimeout(t) }, [input])
  const kind = q ? 'search' : tab
  const list = useInfiniteQuery({
    queryKey: ['klipy', kind, q, cid],
    queryFn: ({ pageParam }) => klipy.list(kind, pageParam, cid, q),
    initialPageParam: 1,
    getNextPageParam: (p) => p.next,
  })
  const items = list.data?.pages.flatMap((p) => p.items) ?? []
  const hide = async (slug: string) => {
    try {
      await klipy.hideRecent(slug, cid)
      await qc.invalidateQueries({ queryKey: ['klipy', 'recent'] })
    } catch { toast('지우지 못했어요. 다시 시도해 주세요.') }
  }
  return (
    <div className="flex h-72 flex-col border-t border-hairline bg-paper">
      <div className="px-3 pt-2">
        <input type="search" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Search KLIPY" aria-label="GIF 검색"
          enterKeyHint="search" autoComplete="off" className="h-9 w-full rounded-full bg-mist px-4 t-body outline-none" />
      </div>
      {!q && (
        <div className="pt-1">
          <TextTabs label="GIF 목록" value={tab} onChange={setTab} tabs={[{ value: 'trending', label: '인기' }, { value: 'recent', label: '최근 보낸' }]} />
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2 pt-2">
        {items.length ? (
          <div className="grid grid-cols-3 gap-1.5 md:grid-cols-4">
            {items.map((g, i) => (
              <div key={`${i}-${g.slug}`} className="relative">
                <button type="button" disabled={busy} onClick={() => onPick(g, q)} aria-label="GIF 보내기"
                  className="block aspect-square w-full overflow-hidden rounded-lg bg-mist active:opacity-70">
                  <img src={g.preview} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />
                </button>
                {kind === 'recent' && (
                  <button type="button" onClick={() => hide(g.slug)} aria-label="최근 보낸 GIF 에서 지우기"
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white"><IconClose size={14} /></button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="py-10 text-center t-sub text-graphite">
            {list.isLoading ? '불러오는 중…' : list.isError ? 'GIF 를 불러오지 못했어요.' : kind === 'recent' ? '최근 보낸 GIF 가 없어요' : '찾는 GIF 가 없어요'}
          </p>
        )}
        {list.hasNextPage && <LoadMore key={items.length} onMore={() => list.fetchNextPage()} loading={list.isFetchingNextPage} />}
        <p className="mt-1 text-right text-[11px] text-graphite">Powered by KLIPY</p>
      </div>
    </div>
  )
}

