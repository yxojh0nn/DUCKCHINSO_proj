import { useRef } from 'react'
import { compressImage } from '@/lib/image'
import { toast } from '@/store/ui'

// 사진 고르기 버튼. 고른 사진은 줄여서(compressImage) 넘긴다
export function ImageButton({ onPick, children, label, className = '', multiple }: {
  onPick: (blobs: Blob[]) => void; children: React.ReactNode; label: string; className?: string; multiple?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  return (
    <>
      <button type="button" aria-label={label} onClick={() => input.current?.click()} className={className}>{children}</button>
      <input ref={input} type="file" accept="image/*" multiple={multiple} hidden
        onChange={async (e) => {
          const files = [...(e.target.files ?? [])]
          e.target.value = ''
          if (files.some((f) => f.size > 20 * 1024 * 1024)) return toast('20MB보다 큰 사진은 올릴 수 없어요.')
          try { onPick(await Promise.all(files.map((f) => compressImage(f)))) } catch { toast('사진을 읽지 못했어요.') }
        }} />
    </>
  )
}
