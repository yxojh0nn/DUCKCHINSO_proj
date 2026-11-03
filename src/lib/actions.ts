import { useQueryClient } from '@tanstack/react-query'
import { api, errorText } from '@/api'
import { toast } from '@/store/ui'
import { keys } from './queries'

// 여러 화면에서 같은 결과(문구·캐시 갱신)를 내야 하는 동작 모음
export function useFriendActions() {
  const qc = useQueryClient()
  const refresh = () => Promise.all([
    qc.invalidateQueries({ queryKey: keys.requests }),
    qc.invalidateQueries({ queryKey: keys.recommend }),
    qc.invalidateQueries({ queryKey: keys.friends }),
    qc.invalidateQueries({ queryKey: keys.rooms }),
    qc.invalidateQueries({ queryKey: ['profile'] }),
  ])
  const run = async (f: () => Promise<unknown>, done: string) => {
    try { await f(); toast(done); await refresh(); return true } catch (e) { toast(errorText(e)); return false }
  }
  return {
    request: (id: string) => run(() => api.sendFriendRequest(id), '친구 요청을 보냈어요'),
    accept: (reqId: string) => run(() => api.respondRequest(reqId, true), '친구가 됐어요. 채팅 탭에서 대화해 보세요'),
    decline: (reqId: string) => run(() => api.respondRequest(reqId, false), '요청을 거절했어요. 상대에게는 알리지 않아요'),
    remove: (id: string) => run(() => api.removeFriend(id), '친구를 삭제했어요'),
    block: (id: string) => run(async () => { await api.block(id); await qc.invalidateQueries({ queryKey: keys.blocked }) }, '차단했어요. 상대에게는 알리지 않아요'),
    unblock: (id: string) => run(async () => { await api.unblock(id); await qc.invalidateQueries({ queryKey: keys.blocked }) }, '차단을 해제했어요'),
  }
}
