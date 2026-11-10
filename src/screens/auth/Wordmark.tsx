// 로고: 공연 티켓(오른쪽 절취 홈·절취선) + 말풍선 + 이퀄라이저 막대 (design/brand/v4/b-ticket-v2.svg)
// currentColor 라서 라이트 테마는 검정, 다크 테마는 흰색. 막대는 바탕색으로 칠해 애니메이션이 가능하게 둔다
const BODY = 'M48 44 H208 A24 24 0 0 1 232 68 V100 A22 22 0 0 0 232 144 V164 A24 24 0 0 1 208 188 H104 L60 224 V188 H48 A24 24 0 0 1 24 164 V68 A24 24 0 0 1 48 44 Z M166 66 h12 v18 h-12 Z M166 98 h12 v18 h-12 Z M166 130 h12 v18 h-12 Z M166 162 h12 v4 h-12 Z'
// 진입 애니메이션용 조각: 절취선(x 166~178) 왼쪽 본체 / 오른쪽 꼬투리 / 절취선 구멍 사이 다리
const LEFT = 'M48 44 H166 V188 H104 L60 224 V188 H48 A24 24 0 0 1 24 164 V68 A24 24 0 0 1 48 44 Z'
const STUB = 'M178 44 H208 A24 24 0 0 1 232 68 V100 A22 22 0 0 0 232 144 V164 A24 24 0 0 1 208 188 H178 Z'
const BRIDGES = 'M166 44 h12 v22 h-12 Z M166 84 h12 v14 h-12 Z M166 116 h12 v14 h-12 Z M166 148 h12 v14 h-12 Z M166 166 h12 v22 h-12 Z'
const TEAR_X = 178 / 256 // 꼬투리가 떨어져 나간 자리 (심볼 폭 대비)

export function LogoMark({ size = 32, intro }: { size?: number; intro?: boolean }) {
  return (
    <svg viewBox="0 0 256 256" width={size} height={size} fill="currentColor" aria-hidden className={intro ? 'logo-intro' : undefined}>
      <g className="li-body">
        {intro ? <>
          <path d={LEFT} />
          <path className="li-bridge" d={BRIDGES} />
          <path className="li-stub" d={STUB} />
        </> : <path fillRule="evenodd" d={BODY} />}
        <g fill="var(--paper)">
          <rect className="li-bar" x="70" y="92" width="14" height="48" />
          <rect className="li-bar" x="96" y="78" width="14" height="76" />
          <rect className="li-bar" x="122" y="98" width="14" height="36" />
        </g>
      </g>
    </svg>
  )
}

// 서비스 이름 표기: 심볼 + 글자. intro 면 꼬투리가 뜯겨 날아간 자리에서 글자가 미끄러져 나온다
export function Wordmark({ small, intro }: { small?: boolean; intro?: boolean }) {
  const size = small ? 28 : 52
  return (
    <p aria-label="덕친소" className={`flex items-center font-extrabold tracking-[-0.04em] ${small ? 'gap-1.5 text-[26px]' : 'gap-2.5 text-[44px]'}`}>
      <LogoMark size={size} intro={intro} />
      {intro
        ? <span aria-hidden className="overflow-hidden" style={{ marginLeft: -size * (1 - TEAR_X) - 4 }}>
            <span className="logo-intro-text inline-block pl-1.5">덕친소</span>
          </span>
        : <span aria-hidden>덕친소</span>}
    </p>
  )
}
