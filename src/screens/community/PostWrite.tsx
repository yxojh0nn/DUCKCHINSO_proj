import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api, errorText } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { ImageButton } from '@/components/ImageButton'
import { IconClose, IconPhoto } from '@/components/icons'
import { TextArea, TextField } from '@/components/ui/Field'
import { APP_SETTINGS } from '@/lib/settings'
import { useConcerts, useMe } from '@/lib/queries'
import { Empty } from '@/components/ui/Empty'
import { toast } from '@/store/ui'

const parseTags = (s: string) =>
  [...new Set(s.split(/[\s,#]+/).map((t) => t.trim()).filter(Boolean))].slice(0, APP_SETTINGS.maxTags).map((t) => t.slice(0, 20))

// 글쓰기: 제목, 내용, 태그, 사진(최대 4장). 지난 공연에서 "후기 남기기"로 오면(?concert=) 그 공연의 후기가 된다
// 공연 후기·'후기' 태그 글은 MY > 공연 후기에 모인다
export default function PostWrite() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const concertId = useSearchParams()[0].get('concert')
  const concert = useConcerts().data?.find((c) => c.id === concertId)
  const [tags, setTags] = useState(concertId ? '후기' : '')
  const [images, setImages] = useState<{ blob: Blob; url: string }[]>([])
  const [busy, setBusy] = useState(false)
  const ok = title.trim() && body.trim()
  const guest = useMe().data?.isGuest

  const submit = async () => {
    if (!ok || busy) return
    setBusy(true)
    try {
      const id = await api.createPost({ title: title.trim(), body: body.trim(), tags: parseTags(tags), images: images.map((i) => i.blob), concertId: concert?.id ?? null })
      await qc.invalidateQueries({ queryKey: ['posts'] })
      nav(`/community/post/${id}`, { replace: true })
    } catch (e) { toast(errorText(e)) } finally { setBusy(false) }
  }

  if (guest) return <><AppHeader back title="글쓰기" /><Empty title="글은 회원만 쓸 수 있어요" body="회원으로 로그인하면 글과 공연 후기를 남길 수 있어요." /></>
  return (
    <div className="flex min-h-full flex-col">
      <AppHeader back title={concert ? '후기 남기기' : '글쓰기'} right={
        <button onClick={submit} disabled={!ok || busy} className="h-11 px-4 t-body font-semibold disabled:opacity-30">{busy ? '올리는 중' : '올리기'}</button>
      } />
      <div className="flex-1 px-5 pt-2">
        {concert && <p className="mb-5 rounded-[10px] bg-mist px-3 py-2.5 t-sub"><b>공연 후기</b> <span className="text-graphite">{concert.title}</span></p>}
        <TextField label="제목" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="제목" />
        <TextArea className="mt-6" label="내용" rows={8} maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)}
          placeholder="공연 후기, 같이 갈 사람 찾기, 덕질 이야기를 자유롭게 남겨 주세요." />
        <TextField className="mt-6" label="태그" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="예) 후기 요아소비 서울"
          hint={parseTags(tags).length ? parseTags(tags).map((t) => `#${t}`).join(' ') : `띄어쓰기로 구분, 최대 ${APP_SETTINGS.maxTags}개. '후기'를 달면 공연 후기에 모여요.`} />
        <p className="mt-6 t-sub font-semibold text-graphite">사진 {images.length}/{APP_SETTINGS.maxPostImages}</p>
        <div className="mt-2 flex gap-2 overflow-x-auto">
          {images.length < APP_SETTINGS.maxPostImages && (
            <ImageButton label="사진 추가" multiple onPick={(bs) => setImages([...images, ...bs.map((blob) => ({ blob, url: URL.createObjectURL(blob) }))].slice(0, APP_SETTINGS.maxPostImages))}
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[12px] bg-mist text-graphite">
              <IconPhoto />
            </ImageButton>
          )}
          {images.map((img, i) => (
            <div key={img.url} className="relative h-20 w-20 shrink-0">
              <img src={img.url} alt={`첨부 사진 ${i + 1}`} className="h-full w-full rounded-[12px] object-cover" />
              <button aria-label={`사진 ${i + 1} 빼기`} onClick={() => setImages(images.filter((x) => x !== img))}
                className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ink text-paper"><IconClose size={13} strokeWidth={2.4} /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
