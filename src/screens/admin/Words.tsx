import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, errorText, type BannedWord, type WordCategory } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { Button } from '@/components/ui/Button'
import { Empty } from '@/components/ui/Empty'
import { TextField } from '@/components/ui/Field'
import { Segmented } from '@/components/ui/Segmented'
import { TextTabs } from '@/components/ui/TextTabs'
import { toast } from '@/store/ui'
import { adminKeys } from './AdminGate'
import { useRun } from '@/lib/actions'

const CATEGORY: Record<WordCategory, string> = { abuse: '욕설', sexual: '성적', hate: '혐오', scam: '사기' }
// DB 는 NFKC 로 저장해 ㅅㅂ 가 첫소리 자모(ᄉᄇ)로 바뀐다. 화면에는 보통 자모로 보여 준다
const LEAD = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'
const showWord = (w: string) => w.replace(/[ᄀ-ᄒᄡ]/g, (c) => c === 'ᄡ' ? 'ㅄ' : LEAD[c.charCodeAt(0) - 0x1100])

// 비속어: 금칙어(글·댓글·프로필은 저장 거절, 채팅은 가림) · 허용어(금칙어를 품은 정상 단어) · 문장 시험
export default function Words() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'banned' | 'allowed'>('banned')
  const list = useQuery({ queryKey: adminKeys.words, queryFn: () => api.adminWords() })
  const [word, setWord] = useState('')
  const [category, setCategory] = useState<WordCategory>('abuse')
  const [exact, setExact] = useState(false)
  const [sample, setSample] = useState('')
  const [result, setResult] = useState<{ word: string | null; masked: string } | null>(null)

  const { busy, run: guarded } = useRun()
  const run = (f: () => Promise<void>, done: string) =>
    guarded(async () => { await f(); await qc.invalidateQueries({ queryKey: adminKeys.words }); toast(done) })
  const add = () => word.trim() && run(async () => {
    await api.adminAddWord(tab === 'allowed' ? { allowed: true, word } : { word, category, match: exact ? 'exact' : 'contains' })
    setWord('')
  }, '추가했어요')
  const remove = (w: string) => run(() => api.adminDeleteWord(tab === 'allowed', w), '삭제했어요')
  const test = async () => {
    if (!sample.trim()) return
    try { setResult(await api.adminTestText(sample)) } catch (e) { toast(errorText(e)) }
  }

  const banned: BannedWord[] = list.data?.banned ?? []
  const rows = tab === 'banned'
    ? banned.map((b) => ({ word: b.word, meta: CATEGORY[b.category] + (b.match === 'exact' ? ' · 닉네임 전체 일치' : '') }))
    : (list.data?.allowed ?? []).map((w) => ({ word: w, meta: '' }))

  return (
    <>
      <AppHeader back title="비속어" />
      <section className="flex flex-col gap-2 px-5 pb-4 pt-1">
        <TextField label="문장 시험" value={sample} onChange={(e) => { setSample(e.target.value); setResult(null) }}
          onKeyDown={(e) => e.key === 'Enter' && test()} placeholder="걸리는지 확인할 문장" maxLength={500} />
        <Button variant="secondary" onClick={test} disabled={!sample.trim()}>시험하기</Button>
        {result && (
          <p className="t-sub text-graphite" role="status">
            {result.word ? <>걸림: <b className="text-ink">{showWord(result.word)}</b> · 채팅에서는 "{result.masked}"</> : '통과해요'}
          </p>
        )}
      </section>
      <div className="border-b border-hairline">
        <TextTabs label="목록 종류" value={tab} onChange={(v) => { setTab(v); setWord('') }}
          tabs={[{ value: 'banned', label: `금칙어 ${banned.length}` }, { value: 'allowed', label: `허용어 ${list.data?.allowed.length ?? 0}` }]} />
      </div>
      <form className="flex flex-col gap-2 px-5 py-4" onSubmit={(e) => { e.preventDefault(); add() }}>
        <TextField label={tab === 'banned' ? '금칙어 추가' : '허용어 추가'} value={word} onChange={(e) => setWord(e.target.value)} maxLength={30}
          hint={tab === 'banned' ? '띄어쓰기·기호는 지워서 저장돼요. 이미 올라온 글은 다시 검사하지 않아요.' : '금칙어를 품은 정상 단어 (예: 시발점, 등신대)'} />
        {tab === 'banned' && (
          <>
            <Segmented label="분류" value={category} onChange={setCategory}
              options={(Object.keys(CATEGORY) as WordCategory[]).map((c) => ({ value: c, label: CATEGORY[c] }))} />
            <label className="flex min-h-[44px] items-center gap-2 t-sub">
              <input type="checkbox" checked={exact} onChange={(e) => setExact(e.target.checked)} className="h-5 w-5" />
              닉네임 전체가 이 단어일 때만 막기 (짧은 단어용)
            </label>
          </>
        )}
        <Button type="submit" disabled={!word.trim() || busy}>추가</Button>
      </form>
      {rows.length ? (
        <ul className="pb-8">
          {rows.map((r) => (
            <li key={r.word} className="flex min-h-[52px] items-center gap-3 border-t border-hairline px-5">
              <span className="min-w-0 flex-1 truncate t-body">{showWord(r.word)}{r.meta && <span className="ml-2 t-cap text-graphite">{r.meta}</span>}</span>
              <button onClick={() => remove(r.word)} disabled={busy} className="h-11 px-2 t-sub text-graphite">삭제</button>
            </li>
          ))}
        </ul>
      ) : <Empty title={list.isLoading ? '불러오는 중…' : '목록이 비어 있어요'} />}
    </>
  )
}
