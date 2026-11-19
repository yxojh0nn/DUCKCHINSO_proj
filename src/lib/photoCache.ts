// 비공개 버킷 사진을 한 번 내려받으면 기기에 둔다: 메모리(같은 실행) → Cache Storage(다음 실행) → 서버
// 키(저장 경로)에 무작위 파일 이름이 들어가 내용이 바뀌지 않으므로 만료 없이 쓴다
const mem = new Map<string, Promise<string>>()
const NAME = 'diary-photos-v1'
const req = (key: string) => new Request(`/__photo-cache/${encodeURIComponent(key)}`)
const store = () => (typeof caches === 'undefined' ? Promise.resolve(null) : caches.open(NAME).catch(() => null))

export function cachedPhotoUrl(key: string, download: () => Promise<Blob>): Promise<string> {
  let p = mem.get(key)
  if (!p) {
    p = (async () => {
      const c = await store()
      const hit = await c?.match(req(key)).catch(() => undefined)
      const blob = hit ? await hit.blob() : await download()
      if (!hit) await c?.put(req(key), new Response(blob, { headers: { 'Content-Type': blob.type } })).catch(() => {})
      return URL.createObjectURL(blob)
    })()
    mem.set(key, p)
    p.catch(() => mem.delete(key)) // 실패는 다음에 다시
  }
  return p
}

export async function dropCachedPhoto(key: string) {
  mem.get(key)?.then(URL.revokeObjectURL, () => {})
  mem.delete(key)
  await (await store())?.delete(req(key)).catch(() => {})
}

// 로그아웃·탈퇴 때 기기에 남은 사진을 지운다
export async function clearPhotoCache() {
  mem.forEach((p) => p.then(URL.revokeObjectURL, () => {}))
  mem.clear()
  if (typeof caches !== 'undefined') await caches.delete(NAME).catch(() => {})
}
