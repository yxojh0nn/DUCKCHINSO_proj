import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Confirm } from '@/components/ui/Confirm'
import { api, errorText } from '@/api'
import { toast } from '@/store/ui'
import { keys } from './queries'

// 처리 중 표시 + 실패하면 오류 토스트. 처리 중에 다시 부르면 무시한다 (버튼 연타 방지)
// onError: 토스트 뒤에 할 일 (캡차 다시 받기 등)
export function useRun() {
  const [busy, setBusy] = useState(false)
  const run = async (f: () => Promise<unknown>, onError?: () => void) => {
    if (busy) return
    setBusy(true)
    try { await f() } catch (err) { toast(errorText(err)); onError?.() } finally { setBusy(false) }
  }
  return { busy, run }
}

// 여러 화면에서 같은 결과(문구·캐시 갱신)를 내야 하는 동작 모음
// 친구 요청은 낯선 사람에게 처음 말을 거는 순간이라 바로 보내지 않는다: ask → 확인 창(dialog) → 보낸 뒤 토스트에서 취소 가능
export function useFriendActions() {
  const qc = useQueryClient()
  const refresh = () => Promise.all([
    qc.invalidateQueries({ queryKey: keys.requests }),
    qc.invalidateQueries({ queryKey: keys.recommend }),
    qc.invalidateQueries({ queryKey: keys.friends }),
    qc.invalidateQueries({ queryKey: keys.rooms }),
    qc.invalidateQueries({ queryKey: ['profile'] }),
  ])
  const run = async (f: () => Promise<unknown>, done: string, undo?: () => void) => {
    try { await f(); toast(done, undo && { label: '취소', run: undo }); await refresh(); return true } catch (e) { toast(errorText(e)); return false }
  }
  const [asking, setAsking] = useState<{ id: string; nickname: string } | null>(null)
  const cancel = (id: string) => run(() => api.cancelFriendRequest(id), '친구 요청을 취소했어요')
  const request = (id: string) => run(() => api.sendFriendRequest(id), '친구 요청을 보냈어요', () => void cancel(id))
  return {
    ask: (user: { id: string; nickname: string }) => setAsking(user),
    dialog: (
      <Confirm open={!!asking} title={`${asking?.nickname ?? ''} 님에게 친구 요청을 보낼까요?`}
        message="수락하면 1:1 채팅을 할 수 있어요. 보낸 요청은 '친구 요청'에서 언제든 취소할 수 있어요."
        confirmLabel="요청 보내기" onClose={() => setAsking(null)}
        onConfirm={() => { const u = asking; setAsking(null); if (u) void request(u.id) }} />
    ),
    request,
    cancel,
    accept: (reqId: string) => run(() => api.respondRequest(reqId, true), '친구가 됐어요. 채팅 탭에서 대화해 보세요'),
    decline: (reqId: string) => run(() => api.respondRequest(reqId, false), '요청을 거절했어요. 상대에게는 알리지 않아요'),
    remove: (id: string) => run(() => api.removeFriend(id), '친구를 삭제했어요'),
    block: (id: string) => run(async () => { await api.block(id); await qc.invalidateQueries({ queryKey: keys.blocked }) }, '차단했어요. 상대에게는 알리지 않아요'),
    unblock: (id: string) => run(async () => { await api.unblock(id); await qc.invalidateQueries({ queryKey: keys.blocked }) }, '차단을 해제했어요'),
  }
}
