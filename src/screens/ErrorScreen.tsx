import { Component, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

// 오류 화면 그림: 꼬투리가 뜯겨 나간 티켓 로고 (공연을 못 들어간 표 느낌). 글자색 따라 라이트·다크
const LEFT = 'M48 44 H166 V188 H104 L60 224 V188 H48 A24 24 0 0 1 24 164 V68 A24 24 0 0 1 48 44 Z M70 92h14v48h-14z M96 78h14v76h-14z M122 98h14v36h-14z'
const STUB = 'M166 44 H208 A24 24 0 0 1 232 68 V100 A22 22 0 0 0 232 144 V164 A24 24 0 0 1 208 188 H166 Z'
  + [69.2, 100.4, 131.6, 162.8].map((y) => ` M166 ${y} a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0 Z`).join('')
export function TornTicket({ size = 132 }: { size?: number }) {
  return (
    <svg viewBox="0 0 300 260" width={size} height={size * 260 / 300} aria-hidden className="text-ink">
      <path fillRule="evenodd" fill="currentColor" d={LEFT} />
      <path fillRule="evenodd" fill="currentColor" opacity="0.35" d={STUB} transform="translate(34 30) rotate(16 166 188)" />
    </svg>
  )
}

type Props = { code?: string; title: string; body: string; children?: ReactNode }
export function ErrorScreen({ code, title, body, children }: Props) {
  return (
    <main className="flex min-h-full flex-col items-center justify-center px-8 py-12 text-center">
      <TornTicket />
      {code && <p className="mt-6 t-sub font-semibold text-graphite num">{code}</p>}
      <h1 className="mt-1 t-title">{title}</h1>
      <p className="mt-2 max-w-[300px] t-body text-graphite">{body}</p>
      <div className="mt-8 flex w-full max-w-[280px] flex-col gap-2">{children}</div>
    </main>
  )
}

const btn = 'h-12 rounded-full t-body font-semibold active:opacity-70'

// 없는 주소
export function NotFound() {
  const nav = useNavigate()
  return (
    <ErrorScreen code="404" title="페이지를 찾을 수 없어요" body="주소가 바뀌었거나 지워진 페이지예요.">
      <button className={`${btn} bg-ink text-paper`} onClick={() => nav('/', { replace: true })}>처음 화면으로</button>
      <button className={`${btn} bg-mist`} onClick={() => nav(-1)}>뒤로 가기</button>
    </ErrorScreen>
  )
}

// 서버에서 정보를 못 받아 화면을 띄울 수 없을 때 (점검·네트워크 끊김 등)
export function ServerError({ onRetry, onLeave }: { onRetry: () => void; onLeave?: () => void }) {
  const offline = typeof navigator !== 'undefined' && !navigator.onLine
  return (
    <ErrorScreen code={offline ? undefined : '오류'} title={offline ? '인터넷에 연결되어 있지 않아요' : '정보를 불러오지 못했어요'}
      body={offline ? '연결을 확인한 뒤 다시 시도해 주세요.' : '서버가 잠시 응답하지 않아요. 잠시 뒤 다시 시도해 주세요.'}>
      <button className={`${btn} bg-ink text-paper`} onClick={onRetry}>다시 시도</button>
      {onLeave && <button className={`${btn} bg-mist`} onClick={onLeave}>로그인 화면으로</button>}
    </ErrorScreen>
  )
}

// 화면을 그리다 예기치 못한 오류가 나면 흰 화면 대신 이 화면. 배포 직후 옛 파일을 못 찾는 경우도 새로 고침으로 풀린다
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(e: unknown) { console.error(e) }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="h-full bg-paper">
        <ErrorScreen code="오류" title="화면을 보여 드리지 못했어요" body="일시적인 문제예요. 새로 고침하면 대부분 해결돼요.">
          <button className={`${btn} bg-ink text-paper`} onClick={() => location.reload()}>새로 고침</button>
          <button className={`${btn} bg-mist`} onClick={() => location.assign('/')}>처음 화면으로</button>
        </ErrorScreen>
      </div>
    )
  }
}
