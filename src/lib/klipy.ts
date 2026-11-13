// KLIPY GIF API. 규칙(docs.klipy.com/integration-requirements): 요청·미디어는 사용자 기기에서 직접 부르고(서버 경유 X),
// 받은 주소를 고치거나 다시 올리지 않으며, 검색·인기 결과의 순서를 바꾸거나 빼지 않는다. 앱 키는 원래 공개되는 값이다
const KEY = import.meta.env?.VITE_KLIPY_APP_KEY as string | undefined // ?.: node 로 도는 단위 테스트엔 env 가 없다
const BASE = `https://api.klipy.com/api/v1/${KEY}/gifs`

export const klipyOn = !!KEY
// DB 제약(messages_image_source)과 같은 규칙
export const isKlipyUrl = (u: string) => /^https:\/\/static[12]?\.klipy\.com\//.test(u)

export type KlipyGif = { slug: string; preview: string; url: string }
export type KlipyPage = { items: KlipyGif[]; next: number | null }
export type KlipyList = 'trending' | 'recent' | 'search'

// customer_id: 사용자마다 늘 같은 값이어야 한다. 회원 id 를 그대로 내보내지 않고 해시로
export async function customerId(uid: string) {
  const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`duckchinso:${uid}`))
  return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

type File = { url: string }
type Item = { slug: string; file?: Record<'hd' | 'md' | 'sm' | 'xs', { webp?: File; gif?: File } | undefined> }

async function call(path: string, init?: RequestInit) {
  const r = await fetch(`${BASE}${path}`, init)
  if (!r.ok) throw new Error('klipy_failed')
  return r.json()
}
const post = (path: string, body: object) =>
  call(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export function toPage(j: { data?: { data?: Item[]; current_page?: number; has_next?: boolean } }): KlipyPage {
  const d = j.data ?? {}
  const pick = (f?: { webp?: File; gif?: File }) => f?.webp?.url ?? f?.gif?.url
  const items: KlipyGif[] = []
  for (const x of d.data ?? []) {
    const url = pick(x.file?.md), preview = pick(x.file?.sm) ?? url
    if (url && preview) items.push({ slug: x.slug, url, preview }) // 그릴 파일이 없는 항목(광고 등)만 건너뛴다. 순서는 그대로
  }
  return { items, next: d.has_next ? (d.current_page ?? 1) + 1 : null }
}

export const klipy = {
  async list(kind: KlipyList, page: number, cid: string, q = ''): Promise<KlipyPage> {
    const p = new URLSearchParams({ page: String(page), per_page: '24', locale: 'kr', content_filter: 'high', format_filter: 'webp,gif' })
    if (kind === 'recent') return toPage(await call(`/recent/${cid}?${p}`))
    p.set('customer_id', cid)
    if (kind === 'search') p.set('q', q)
    return toPage(await call(`/${kind}?${p}`))
  },
  // 보낸 GIF 를 KLIPY 에 알린다 → 최근 보낸 GIF 에 쌓인다. q 는 검색해서 보냈을 때만
  share: (slug: string, cid: string, q?: string) => post(`/share/${encodeURIComponent(slug)}`, { customer_id: cid, ...(q ? { q } : {}) }),
  hideRecent: (slug: string, cid: string) => call(`/recent/${cid}?${new URLSearchParams({ slug })}`, { method: 'DELETE' }),
  report: (slug: string, cid: string, reason: string) => post(`/report/${encodeURIComponent(slug)}`, { customer_id: cid, reason }),
}
