import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type ContributionKind, type InfoCategory } from '@/api'
import { Button, Chip } from '@/components/ui/Button'
import { TextArea, TextField } from '@/components/ui/Field'
import { Sheet } from '@/components/ui/Sheet'
import { CATEGORIES, CATEGORY_LABEL, CONTRIB_CONSENT } from '@/data/contrib'
import { fmtDateTime } from '@/lib/date'
import { keys, useGenres, useMe } from '@/lib/queries'
import { toast } from '@/store/ui'
import { useRun } from '@/lib/actions'

const TITLE: Record<ContributionKind, string> = { ticket_open: '예매 오픈일 알려 주기', genre: '장르 알려 주기', info: '공연 정보 알려 주기' }

// 정보 제보 (회원만). 첫 이용이면 동의부터 받는다. 운영자가 확인해 반영하면 포인트를 준다
// (예매처 사이트는 약관·봇 차단 때문에 자동 수집하지 않는다)
export function ContributeSheet({ open, onClose, concertId, kind, category = 'tips' }: {
  open: boolean; onClose: () => void; concertId: string; kind: ContributionKind; category?: InfoCategory
}) {
  const qc = useQueryClient()
  const me = useMe().data
  const genres = useGenres().data ?? []
  const restriction = useQuery({ queryKey: keys.contribRestriction, queryFn: () => api.myContribRestriction(), enabled: open })
  const { busy, run } = useRun()
  const [at, setAt] = useState('') // datetime-local 값 (이 기기 시간대 = 한국)
  const [url, setUrl] = useState('')
  const [genreId, setGenreId] = useState<number | null>(null)
  const [cat, setCat] = useState<InfoCategory>(category)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')

  if (!open || !me) return null
  const agreed = !!me.consents.contribution
  const urlOk = /^https?:\/\/\S+$/.test(url)
  const ok = kind === 'ticket_open' ? !!at && urlOk
    : kind === 'genre' ? genreId !== null
    : !!title.trim() && body.trim().length >= 10 && (!url || urlOk)

  const agree = () => run(async () => {
    await api.agreeContribution()
    await qc.invalidateQueries({ queryKey: keys.me })
  })
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!ok || busy) return
    return run(async () => {
      await api.submitContribution(concertId,
        kind === 'ticket_open' ? { kind, openAt: new Date(at).toISOString(), sourceUrl: url }
          : kind === 'genre' ? { kind, genreId: genreId! }
          : { kind, category: cat, title: title.trim(), body: body.trim(), sourceUrl: url || undefined })
      await qc.invalidateQueries({ queryKey: keys.myContribs })
      toast('제보를 보냈어요. 운영자가 확인한 뒤 반영되면 포인트를 드려요.')
      setAt(''); setUrl(''); setGenreId(null); setTitle(''); setBody(''); onClose()
    })
  }

  const r = restriction.data
  return (
    <Sheet open onClose={onClose} title={TITLE[kind]}
      message={r ? undefined : !agreed ? '처음 한 번만 아래 내용에 동의해 주세요.' : kind === 'ticket_open' ? '공식 공지에서 본 날짜와 그 공지 링크를 알려 주세요.' : undefined}>
      {r ? (
        <p className="px-5 pb-6 pt-2 t-body">
          {r.endsAt ? <><span className="num">{fmtDateTime(r.endsAt)}</span>까지</> : '앞으로'} 정보 제보 기능을 쓸 수 없어요.
          <span className="mt-1 block t-sub text-graphite">사유: {r.reason}</span>
        </p>
      ) : !agreed ? (
        <div className="px-5 pb-5 pt-2">
          <ul className="list-disc space-y-1.5 pl-5 t-sub">{CONTRIB_CONSENT.map((t) => <li key={t}>{t}</li>)}</ul>
          <Button block className="mt-6" disabled={busy} onClick={agree}>동의하고 계속하기</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="px-5 pb-5 pt-2">
          {kind === 'ticket_open' && (
            <>
              <label className="block t-sub font-semibold text-graphite" htmlFor="tip-at">예매 오픈 일시</label>
              <input id="tip-at" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)}
                className="mt-1 block h-11 w-full border-b border-hairline outline-none t-body focus:border-ink" />
            </>
          )}
          {kind === 'genre' && (
            <fieldset>
              <legend className="t-sub font-semibold text-graphite">장르</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {genres.map((g) => <Chip key={g.id} on={genreId === g.id} onClick={() => setGenreId(g.id)}>{g.name}</Chip>)}
              </div>
            </fieldset>
          )}
          {kind === 'info' && (
            <>
              <fieldset>
                <legend className="t-sub font-semibold text-graphite">분류</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => <Chip key={c} on={cat === c} onClick={() => setCat(c)}>{CATEGORY_LABEL[c]}</Chip>)}
                </div>
              </fieldset>
              <TextField className="mt-5" label="제목" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={40} />
              <TextArea className="mt-5" label="내용 (10~1000자)" value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} rows={5}
                hint="연락처·계좌 등 개인정보는 쓰지 말아 주세요." />
            </>
          )}
          {kind !== 'genre' && (
            <TextField className="mt-5" label={kind === 'info' ? '출처 링크 (선택)' : '공지 링크'} type="url" inputMode="url" placeholder="https://"
              value={url} onChange={(e) => setUrl(e.target.value.trim())} maxLength={500}
              error={url && !urlOk ? 'https:// 로 시작하는 주소를 넣어 주세요.' : undefined}
              hint="운영자 확인용이에요. 공개 화면에는 보이지 않아요." />
          )}
          <Button type="submit" block className="mt-6" disabled={!ok || busy}>{busy ? '보내는 중…' : '제보하기'}</Button>
        </form>
      )}
    </Sheet>
  )
}
