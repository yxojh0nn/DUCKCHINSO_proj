// 로고: 공연 티켓(오른쪽 절취 홈·절취선) + 말풍선 + 이퀄라이저 막대 (design/brand/v4/b-ticket-v2.svg)
// currentColor 라서 라이트 테마는 검정, 다크 테마는 흰색. 막대는 바탕색으로 칠해 애니메이션이 가능하게 둔다
// 절취선: 지름 12(=절취선 폭 x 166~178) 점 4개. 위·아래 여백과 점 사이 간격이 모두 19.2 로 같다
const HOLES = [69.2, 100.4, 131.6, 162.8].map((y) => `M166 ${y} a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0 Z`).join(' ')
const OUTLINE = 'M48 44 H208 A24 24 0 0 1 232 68 V100 A22 22 0 0 0 232 144 V164 A24 24 0 0 1 208 188 H104 L60 224 V188 H48 A24 24 0 0 1 24 164 V68 A24 24 0 0 1 48 44 Z'
const BODY = `${OUTLINE} ${HOLES}`
// 진입 애니메이션 조각: 절취선 왼쪽 본체 / 절취선(점 포함)부터 오른쪽 꼬투리. 절취선은 꼬투리와 함께 뜯겨 나간다
const LEFT = 'M48 44 H166 V188 H104 L60 224 V188 H48 A24 24 0 0 1 24 164 V68 A24 24 0 0 1 48 44 Z'
const STUB = `M166 44 H208 A24 24 0 0 1 232 68 V100 A22 22 0 0 0 232 144 V164 A24 24 0 0 1 208 188 H166 Z ${HOLES}`
const TEAR_X = 178 / 256 // 글자가 나오는 자리 (심볼 폭 대비, 정지 로고와 글자 간격을 맞춘 값)

export function LogoMark({ size = 32, intro }: { size?: number; intro?: boolean }) {
  return (
    <svg viewBox="0 0 256 256" width={size} height={size} fill="currentColor" aria-hidden className={intro ? 'logo-intro' : undefined}>
      <g className="li-body">
        {/* 진입: 뜯기기 전까지는 정지 로고와 같은 한 덩어리(조각 경계의 가는 선이 안 보이게), 뜯기는 순간 조각으로 바꾼다 */}
        <path className={intro ? 'li-whole' : undefined} fillRule="evenodd" d={BODY} />
        {intro && <g className="li-pieces">
          <path d={LEFT} />
          <path className="li-stub" fillRule="evenodd" d={STUB} />
        </g>}
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
