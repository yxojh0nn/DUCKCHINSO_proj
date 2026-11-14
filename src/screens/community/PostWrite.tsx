import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { ImageButton } from '@/components/ImageButton'
import { IconClose, IconPhoto } from '@/components/icons'
import { TextArea, TextField } from '@/components/ui/Field'
import { APP_SETTINGS } from '@/lib/settings'
import { keys, useConcerts, useMe } from '@/lib/queries'
import { Empty } from '@/components/ui/Empty'
import { useRun } from '@/lib/actions'

// 작성 중인 글 임시 저장: 뒤로 가기(제스처 포함)·앱 종료로 나가도 다시 열면 이어 쓴다. 공연 후기는 공연마다 따로
// shortcut: 사진(Blob)은 저장하지 않는다. 사진까지 지켜야 하면 IndexedDB 로 옮긴다
type Draft = { title: string; body: string; tags: string }
const draftKey = (concertId: string | null) => `duckchinso-draft:${concertId ?? 'free'}`
const readDraft = (key: string): Draft | null => { try { return JSON.parse(localStorage.getItem(key) ?? 'null') } catch { return null } }
const writeDraft = (key: string, d: Draft | null) => {
  try { if (d && (d.title.trim() || d.body.trim())) localStorage.setItem(key, JSON.stringify(d)); else localStorage.removeItem(key) } catch { /* 저장 공간 없음: 임시 저장만 건너뛴다 */ }
}

const parseTags = (s: string) =>
  [...new Set(s.split(/[\s,#]+/).map((t) => t.trim()).filter(Boolean))].slice(0, APP_SETTINGS.maxTags).map((t) => t.slice(0, 20))

// 글쓰기: 제목, 내용, 태그, 사진(최대 4장). 지난 공연에서 "후기 남기기"로 오면(?concert=) 그 공연의 후기가 된다
// 공연 후기·'후기' 태그 글은 MY > 공연 후기에 모인다
// ?edit=글ID 면 내 글 수정: 제목·내용·태그만 (사진·공연 연결은 그대로, 서버 edit_post 가 작성자를 확인한다)
export default function PostWrite() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const params = useSearchParams()[0]
  const concertId = params.get('concert')
  const editId = params.get('edit')
  const key = draftKey(concertId)
  const [draft] = useState(() => (editId ? null : readDraft(key))) // 처음 열 때 한 번만 읽는다
  const [title, setTitle] = useState(draft?.title ?? '')
  const [body, setBody] = useState(draft?.body ?? '')
  const [restored, setRestored] = useState(!!draft)
  const editing = useQuery({ queryKey: keys.post(editId ?? ''), queryFn: () => api.getPost(editId!), enabled: !!editId })
  const [loaded, setLoaded] = useState(false)
  const concert = useConcerts().data?.find((c) => c.id === concertId)
  const [tags, setTags] = useState(draft?.tags ?? (concertId ? '후기' : ''))
  const [images, setImages] = useState<{ blob: Blob; url: string }[]>([])
  const { busy, run } = useRun()
  const ok = title.trim() && body.trim()
  const guest = useMe().data?.isGuest
  useEffect(() => { if (!editId) writeDraft(key, { title, body, tags }) }, [editId, key, title, body, tags])
  const discard = () => { writeDraft(key, null); setTitle(''); setBody(''); setTags(concertId ? '후기' : ''); setRestored(false) }
  if (editing.data && !loaded) { setTitle(editing.data.title); setBody(editing.data.body); setTags(editing.data.tags.join(' ')); setLoaded(true) }

  const submit = async () => {
    if (!ok || busy) return
    return run(async () => {
      if (editId) {
        await api.editPost(editId, { title: title.trim(), body: body.trim(), tags: parseTags(tags) })
        await Promise.all([qc.invalidateQueries({ queryKey: keys.post(editId) }), qc.invalidateQueries({ queryKey: ['posts'] })])
        return nav(-1)
      }
      const id = await api.createPost({ title: title.trim(), body: body.trim(), tags: parseTags(tags), images: images.map((i) => i.blob), concertId: concert?.id ?? null })
      writeDraft(key, null)
      await qc.invalidateQueries({ queryKey: ['posts'] })
      nav(`/community/post/${id}`, { replace: true })
    })
  }

  if (guest) return <><AppHeader back title="글쓰기" /><Empty title="글은 회원만 쓸 수 있어요" body="회원으로 로그인하면 글과 공연 후기를 남길 수 있어요." /></>
  return (
    <div className="flex min-h-full flex-col">
      <AppHeader back title={editId ? '글 수정' : concert ? '후기 남기기' : '글쓰기'} right={
        <button onClick={submit} disabled={!ok || busy} className="h-11 px-4 t-body font-semibold disabled:opacity-30">{busy ? (editId ? '저장 중' : '올리는 중') : editId ? '저장' : '올리기'}</button>
      } />
      <div className="flex-1 px-5 pt-2">
        {restored && (
          <p role="status" className="mb-5 flex items-center justify-between gap-3 rounded-[10px] bg-mist py-1 pl-3 pr-1 t-sub">
            <span>작성 중이던 글을 불러왔어요</span>
            <button onClick={discard} className="h-9 shrink-0 px-2 font-semibold underline underline-offset-4 active:opacity-60">새로 쓰기</button>
          </p>
        )}
        {concert && <p className="mb-5 rounded-[10px] bg-mist px-3 py-2.5 t-sub"><b>공연 후기</b> <span className="text-graphite">{concert.title}</span></p>}
        <TextField label="제목" value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder="제목" />
        <TextArea className="mt-6" label="내용" rows={8} maxLength={5000} value={body} onChange={(e) => setBody(e.target.value)}
          placeholder="공연 후기, 같이 갈 사람 찾기, 덕질 이야기를 자유롭게 남겨 주세요."
          hint={editId ? undefined : '쓰는 내용은 이 기기에 자동으로 임시 저장돼요. (사진 제외)'} />
        <TextField className="mt-6" label="태그" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="예) 후기 요아소비 서울"
          hint={parseTags(tags).length ? parseTags(tags).map((t) => `#${t}`).join(' ') : `띄어쓰기로 구분, 최대 ${APP_SETTINGS.maxTags}개. '후기'를 달면 공연 후기에 모여요.`} />
        {editId ? <p className="mt-6 t-sub text-graphite">사진은 수정할 수 없어요.</p> : <>
        <p className="mt-6 t-sub font-semibold text-graphite">사진 {images.length}/{APP_SETTINGS.maxPostImages}</p>
        <div className="-mt-1 flex gap-2 overflow-x-auto pt-3 pr-3">
          {images.length < APP_SETTINGS.maxPostImages && (
            <ImageButton label="사진 추가" multiple onPick={(bs) => setImages([...images, ...bs.map((blob) => ({ blob, url: URL.createObjectURL(blob) }))].slice(0, APP_SETTINGS.maxPostImages))}
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[12px] bg-mist text-graphite">
              <IconPhoto />
            </ImageButton>
          )}
          {images.map((img, i) => (
            <div key={img.url} className="relative h-20 w-20 shrink-0">
              <img src={img.url} alt={`첨부 사진 ${i + 1}`} className="h-full w-full rounded-[12px] object-cover" />
              {/* 보이는 동그라미는 24px, 누르는 영역은 40px */}
              <button aria-label={`사진 ${i + 1} 빼기`} onClick={() => setImages(images.filter((x) => x !== img))}
                className="absolute -right-3.5 -top-3.5 flex h-10 w-10 items-center justify-center">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-paper"><IconClose size={13} strokeWidth={2.4} /></span>
              </button>
            </div>
          ))}
        </div>
        </>}
      </div>
    </div>
  )
}
