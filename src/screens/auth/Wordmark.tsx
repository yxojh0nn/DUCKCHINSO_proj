import { useEffect, useRef } from 'react'
// 로고: 공연 티켓(오른쪽 절취 홈·절취선) + 말풍선 + 이퀄라이저 막대 (design/brand/v4/b-ticket-v2.svg)
// currentColor 라서 라이트 테마는 검정, 다크 테마는 흰색. 막대는 바탕색으로 칠해 애니메이션이 가능하게 둔다
// 절취선: 지름 12(=절취선 폭 x 166~178) 점 4개. 위·아래 여백과 점 사이 간격이 모두 19.2 로 같다
const HOLES = [69.2, 100.4, 131.6, 162.8].map((y) => `M166 ${y} a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0 Z`).join(' ')
const OUTLINE = 'M48 44 H208 A24 24 0 0 1 232 68 V100 A22 22 0 0 0 232 144 V164 A24 24 0 0 1 208 188 H104 L60 224 V188 H48 A24 24 0 0 1 24 164 V68 A24 24 0 0 1 48 44 Z'
const BODY = `${OUTLINE} ${HOLES}`
// 진입 애니메이션 조각: 절취선 왼쪽 본체 / 절취선(점 포함)부터 오른쪽 꼬투리. 절취선은 꼬투리와 함께 뜯겨 나간다
const LEFT = 'M48 44 H166 V188 H104 L60 224 V188 H48 A24 24 0 0 1 24 164 V68 A24 24 0 0 1 48 44 Z'
// 꼬투리 모양을 점마다 옮겨(f) 변형한다. 명령 구성이 f 와 무관하게 같아야 SVG animate 가 모양을 보간한다.
// 왼쪽(절취선) 가장자리는 12 간격 점들로 그어 어디서든 꺾이거나 휠 수 있게 한다. 원호는 원이라 회전해도 그대로 쓸 수 있다
type Pt = (x: number, y: number) => [number, number]
const LEFT_YS = Array.from({ length: 11 }, (_, i) => 176 - i * 12) // 176 … 56
const stubShape = (f: Pt) => {
  const p = (x: number, y: number) => f(x, y).map((v) => +v.toFixed(2)).join(' ')
  const holes = [69.2, 100.4, 131.6, 162.8].map((y) => `M${p(166, y)} a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0 Z`).join(' ')
  return `M${p(166, 44)} L${p(208, 44)} A24 24 0 0 1 ${p(232, 68)} L${p(232, 100)} A22 22 0 0 0 ${p(232, 144)} `
    + `L${p(232, 164)} A24 24 0 0 1 ${p(208, 188)} L${p(166, 188)} ${LEFT_YS.map((y) => `L${p(166, y)}`).join(' ')} Z ${holes}`
}
const STUB = stubShape((x, y) => [x, y])
// 뜯기: 절취선이 yt 까지 찢어졌을 때, yt 위쪽만 (166, yt)를 축으로 deg 만큼 바깥으로 젖혀진 모양 (아래쪽은 아직 붙어 있음)
const torn = (yt: number, deg: number) => {
  const c = Math.cos(deg * Math.PI / 180), s = Math.sin(deg * Math.PI / 180)
  return stubShape((x, y) => y >= yt ? [x, y] : [166 + (x - 166) * c + (yt - y) * s, yt + (x - 166) * s - (yt - y) * c])
}
// 손으로 뜯듯 찢어지는 지점이 위에서 아래로 멈춤 없이 고르게 내려감 (0.9초~, 0.7초).
// 처음엔 천천히 시작, 중간은 일정한 속도, 끝에서 부드럽게 멈춤
// 마지막 모양 = 왼쪽 아래 모서리(166,188) 축 13° 회전 = index.css logo-tear 의 끝 → 낙하로 끊김 없이 이어진다
const STUB_TEAR = {
  values: [STUB, torn(72, 15), torn(104, 16), torn(136, 16), torn(170, 16), torn(188, 15), torn(188, 13)].join(';'),
  keyTimes: '0;0.2;0.4;0.6;0.8;0.92;1',
  keySplines: ['.4 0 1 1', '0 0 1 1', '0 0 1 1', '0 0 1 1', '0 0 1 1', '0 0 .58 1'].join(';'),
}
// 낙하 중 원통처럼 휜 모양(AE CC Cylinder 느낌): 세로 가운데가 b 만큼 옆으로 불룩. logo-sway(index.css)와 같은 시점(1.6초~, 1.4초, 같은 keyTimes).
// 꼬투리가 가로로 누우면 b>0 은 가운데가 아래로 처진 U 자(공기를 받는 종이). 왕복 끝마다 조금 펴졌다 다시 휜다
const curl = (b: number) => stubShape((x, y) => [x + b * Math.sin(Math.PI * (y - 44) / 144), y])
const STUB_CURL = { values: [0, 22, 15, 24, 15, 24].map(curl).join(';'), keyTimes: '0;0.2;0.4;0.6;0.8;1' }
const TEAR_X = 178 / 256 // 애니메이션이 끝났을 때 글자 자리 기준 (심볼 폭 대비)
const BODY_RIGHT = 166 / 256 // 꼬투리가 떨어진 뒤 본체 오른쪽 끝

export function LogoMark({ size = 32, intro }: { size?: number; intro?: boolean }) {
  const tear = useRef<SVGAnimateElement>(null)
  const flutter = useRef<SVGAnimateElement>(null)
  useEffect(() => {
    // CSS 진입 애니메이션과 같은 순간에 시작 (모션 줄이기 설정이면 CSS 처럼 생략)
    if (!intro || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    tear.current?.beginElementAt(0.9)
    flutter.current?.beginElementAt(1.6) // 나중에 시작한 animate 가 우선 → 뜯기 끝 모양을 이어받는다
  }, [intro])
  return (
    <svg viewBox="0 0 256 256" width={size} height={size} fill="currentColor" aria-hidden className={intro ? 'logo-intro' : undefined}
      style={intro ? { position: 'relative', zIndex: 1 } : undefined /* 진입: 글자보다 위 → 글자가 본체 뒤에서 빠져나온다 */}>
      <g className="li-body">
        {/* 진입: 뜯기기 전까지는 정지 로고와 같은 한 덩어리(조각 경계의 가는 선이 안 보이게), 뜯기는 순간 조각으로 바꾼다 */}
        <path className={intro ? 'li-whole' : undefined} fillRule="evenodd" d={BODY} />
        {intro && <g className="li-pieces">
          {/* 꼬투리를 본체 뒤에 그린다: 맞닿은 경계·축 근처가 본체에 가려 가는 선이 드러나지 않는다 */}
          {/* 바깥 g: 아래로 낙하·흐려짐 / 안쪽 g: 좌우 왕복·기울기 / path: 뜯기 + 원통 곡선 (index.css 참고) */}
          <g className="li-fall"><g className="li-sway">
            <path className="li-stub" fillRule="evenodd" d={STUB}>
              {/* 모양(d) 보간은 CSS 로 하면 iOS(WebKit)가 지원하지 않아 SVG animate 로 한다 */}
              <animate ref={tear} attributeName="d" begin="indefinite" dur="700ms" fill="freeze" calcMode="spline"
                values={STUB_TEAR.values} keyTimes={STUB_TEAR.keyTimes} keySplines={STUB_TEAR.keySplines} />
              <animate ref={flutter} attributeName="d" begin="indefinite" dur="1400ms" fill="freeze" calcMode="spline"
                values={STUB_CURL.values} keyTimes={STUB_CURL.keyTimes} keySplines={Array(5).fill('.45 0 .55 1').join(';')} />
            </path>
          </g></g>
          <path d={LEFT} />
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
  const gap = small ? 6 : 10 // gap-1.5 / gap-2.5
  // 진입: 글자를 자르는 경계를 본체 오른쪽 끝(1px 안쪽)에 둔다. 전에는 경계가 꼬투리 자리에 있어
  // 미끄러져 나오는 글자의 잘린 면이 로고 오른쪽에 세로 선처럼 보였다. 끝난 뒤 글자 자리는 전과 같다
  const edge = size * BODY_RIGHT - 1
  const textX = size * TEAR_X + gap + 2
  return (
    <p aria-label="덕친소" className={`flex items-center font-extrabold tracking-[-0.04em] ${small ? 'gap-1.5 text-[26px]' : 'gap-2.5 text-[44px]'}`}>
      <LogoMark size={size} intro={intro} />
      {intro
        ? <span aria-hidden className="overflow-hidden" style={{
            marginLeft: edge - size - gap,
            // 글자가 로고보다 키가 커서 로고 위·아래로는 잘린 면이 드러난다 → 경계를 직선으로 자르지 않고 14px 에 걸쳐 흐리게
            // (끝난 글자는 경계에서 15px 이상 안쪽이라 영향 없음)
            maskImage: 'linear-gradient(to right, transparent, #000 14px)', WebkitMaskImage: 'linear-gradient(to right, transparent, #000 14px)',
          }}>
            <span className="logo-intro-text inline-block" style={{ paddingLeft: textX - edge }}>덕친소</span>
          </span>
        : <span aria-hidden>덕친소</span>}
    </p>
  )
}
