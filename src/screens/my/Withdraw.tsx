import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api, errorText } from '@/api'
import { AppHeader } from '@/components/AppHeader'
import { Button } from '@/components/ui/Button'
import { CheckMark } from '@/components/ui/Checkbox'
import { keys, useMe } from '@/lib/queries'
import { toast } from '@/store/ui'

const LOST = [
  '프로필, 닉네임, 소개글, 프로필·배너 사진',
  '관심 아티스트·장르와 관심 공연',
  '친구 목록과 모든 채팅 내용·사진',
  '내가 쓴 글과 댓글, 추천 기록',
]

// 회원탈퇴: 경고 → 확인 체크 → 탈퇴. 내 계정 ID로 묶인 데이터만 지워진다 (비회원은 제공하지 않음)
export default function Withdraw() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const me = useMe().data
  const [ok, setOk] = useState(false)
  const [busy, setBusy] = useState(false)
  if (me?.isGuest) return <Navigate to="/my" replace />

  const withdraw = async () => {
    setBusy(true)
    try {
      await api.deleteAccount()
      qc.clear()
      qc.setQueryData(keys.session, null)
      nav('/login', { replace: true })
      toast('탈퇴가 끝났어요. 그동안 고마웠어요.')
    } catch (e) { toast(errorText(e)); setBusy(false) }
  }

  return (
    <div className="flex min-h-full flex-col">
      <AppHeader back title="회원탈퇴" />
      <div className="flex flex-1 flex-col px-6 pb-[max(24px,env(safe-area-inset-bottom))]">
        <h1 className="mt-2 t-title text-danger">탈퇴하면 모든 정보가 사라져요</h1>
        <p className="mt-2 t-body text-graphite">아래 정보가 즉시 삭제되고 되돌릴 수 없어요.</p>
        <ul className="mt-5 space-y-2.5">
          {LOST.map((l) => <li key={l} className="flex gap-2.5 t-body"><span aria-hidden className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-danger" />{l}</li>)}
        </ul>
        <p className="mt-5 t-sub text-graphite">
          다른 사람을 신고한 기록이나 내가 받은 제재 기록은 법령에 따라 나와의 연결을 끊은 상태로 일정 기간 보관돼요.
        </p>
        <button aria-pressed={ok} onClick={() => setOk(!ok)} className="mt-8 flex min-h-12 items-center gap-3 text-left t-body font-semibold">
          <CheckMark checked={ok} />위 내용을 확인했고 탈퇴에 동의해요
        </button>
        <div className="mt-auto flex flex-col gap-2 pt-6">
          <Button block variant="dangerFill" disabled={!ok || busy} onClick={withdraw}>{busy ? '탈퇴 처리 중…' : '탈퇴하기'}</Button>
          <Button block variant="text" onClick={() => nav(-1)}>계속 이용하기</Button>
        </div>
      </div>
    </div>
  )
}
