import { useNavigate } from 'react-router-dom'
import { api } from '@/api'
import { Button } from '@/components/ui/Button'
import { Wordmark } from './Wordmark'

// 로그인 화면: 회원 로그인 / 비회원으로 시작
// 위쪽 소개는 링크 미리보기 이미지(design/og/og.html)와 같은 구성·비율: 로고 → & + 두 줄. 색은 글자색(ink)이라 라이트·다크 모두 맞는다
export default function Login() {
  const nav = useNavigate()
  return (
    <div className="flex h-full flex-col px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-[max(24px,env(safe-area-inset-top))]">
      <div className="flex flex-1 flex-col justify-center gap-6">
        {/* 심볼 상자의 안쪽 여백만큼 당겨 보이는 왼쪽 끝을 & 와 맞춘다 */}
        <div className="-ml-[5px]"><Wordmark /></div>
        {/* 미리보기 이미지 비율 그대로: 이름 44 : 문구 22 : & 69 (100 : 50 : 156) */}
        <div className="flex items-center gap-2">
          <span aria-hidden className="-ml-[3px] text-[69px] font-[250] leading-[0.8]">&amp;</span>
          <p className="text-[22px] font-semibold leading-[1.24] tracking-[-0.04em]">J-POP 공연 캘린더<br />커뮤니티</p>
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        <Button block onClick={() => nav('/login/member')}>회원 로그인</Button>
        <Button block variant="secondary" onClick={() => nav('/consent?guest=1')}>비회원으로 시작</Button>
        <p className="mt-2 text-center t-cap text-graphite">
          비회원은 캘린더와 커뮤니티 읽기만 할 수 있어요. 글·댓글·덕친(같은 아티스트를 좋아하는 덕질 친구) 찾기·채팅은 회원 전용이에요. 로그아웃하거나 14일 동안 들어오지 않으면 기록이 사라져요.
        </p>
        {api.mode === 'demo' && <p className="text-center t-cap text-graphite">데모 모드: 데이터가 이 브라우저에만 저장돼요.</p>}
      </div>
    </div>
  )
}
