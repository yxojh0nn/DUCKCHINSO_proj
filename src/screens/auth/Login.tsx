import { useNavigate } from 'react-router-dom'
import { api } from '@/api'
import { Button } from '@/components/ui/Button'
import { Wordmark } from './Wordmark'

// 로그인 화면: 회원 로그인 / 비회원으로 시작
export default function Login() {
  const nav = useNavigate()
  return (
    <div className="flex h-full flex-col px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(24px,env(safe-area-inset-top))]">
      <div className="flex flex-1 flex-col justify-center">
        <Wordmark />
        <p className="mt-4 t-title">흩어진 J-pop 공연을<br />한 캘린더에서, 같이 갈 덕친까지.</p>
      </div>
      <div className="flex flex-col gap-2.5">
        <Button block onClick={() => nav('/login/member')}>회원 로그인</Button>
        <Button block variant="secondary" onClick={() => nav('/consent?guest=1')}>비회원으로 시작</Button>
        <p className="mt-2 text-center t-cap text-graphite">
          비회원은 익명 닉네임으로 이용하고 커뮤니티 글은 쓸 수 없어요. 로그아웃하거나 14일 동안 들어오지 않으면 기록이 사라져요.
        </p>
        {api.mode === 'demo' && <p className="text-center t-cap text-graphite">데모 모드: 데이터가 이 브라우저에만 저장돼요.</p>}
      </div>
    </div>
  )
}
