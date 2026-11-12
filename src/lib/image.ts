// 올리기 전에 사진을 줄인다 (긴 변 1280px, JPEG). 용량·데이터 사용량을 줄이고 원본 위치정보(EXIF)도 제거된다
export async function compressImage(file: File, max = 1280): Promise<Blob> {
  if (file.type === 'image/gif' || !file.type.startsWith('image/')) return file // GIF 는 움직임을, 영상은 원본을 지킨다
  const bmp = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * scale)
  canvas.height = Math.round(bmp.height * scale)
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
  bmp.close()
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('image'))), 'image/jpeg', 0.82))
}
