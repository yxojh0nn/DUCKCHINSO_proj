import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { Share } from '@capacitor/share'

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'video/quicktime': 'mov' }

const base64 = (b: Blob) => new Promise<string>((ok, fail) => {
  const r = new FileReader()
  r.onload = () => ok(String(r.result).split(',')[1])
  r.onerror = () => fail(r.error)
  r.readAsDataURL(b)
})

// 사진·영상 저장. PC 웹은 파일 내려받기, 휴대폰은 공유 시트(여기서 '이미지 저장'·'동영상 저장'을 고른다)
// 공유 시트를 닫으면 AbortError 를 던진다. 부르는 쪽에서 무시
export async function saveMedia(url: string) {
  const blob = await (await fetch(url)).blob()
  const name = `duckchinso-${Date.now()}.${EXT[blob.type] ?? (blob.type.split('/')[1] || 'jpg')}`
  if (Capacitor.isNativePlatform()) {
    const { uri } = await Filesystem.writeFile({ path: name, data: await base64(blob), directory: Directory.Cache })
    await Share.share({ files: [uri] })
    return
  }
  const file = new File([blob], name, { type: blob.type })
  if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) return navigator.share({ files: [file] })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
}
