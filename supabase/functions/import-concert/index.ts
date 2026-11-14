// 운영자 '공연 찾기': 수집 목록(kopis_inbox)에서 고른 공연의 상세를 KOPIS 에서 받아 검수 대기로 넣는다
// 자동 판별에서 빠진 공연(아티스트 목록에 없는 경우 등)을 운영자가 직접 가져오는 길. 게시는 검수 화면에서 한다
import { admin, adminGate, cors, json } from '../_shared/supabase.ts'
import { judgeConcert } from '../_shared/kopis.ts'
import { fetchDetail, loadArtists, loadPromoters, saveConcert } from '../_shared/concerts.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const db = admin()
  const denied = await adminGate(req, db)
  if (denied) return denied

  const { kopisId } = await req.json().catch(() => ({}))
  if (typeof kopisId !== 'string' || !/^PF\d+$/.test(kopisId)) return json({ error: 'bad_request' }, 400)
  const key = Deno.env.get('KOPIS_API_KEY')
  if (!key) return json({ error: 'KOPIS_API_KEY missing' }, 500)

  const d = await fetchDetail(key, kopisId)
  if (!d) return json({ error: 'kopis_unavailable' }, 502)
  const [artists, promoters] = await Promise.all([loadArtists(db), loadPromoters(db)])
  const saved = await saveConcert(db, d, judgeConcert(d, artists, promoters), 'review')
  if (!saved) return json({ error: 'save_failed' }, 500)
  return json({ id: saved.id, status: saved.status })
})
