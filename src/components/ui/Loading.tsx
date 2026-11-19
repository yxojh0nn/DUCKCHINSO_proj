// 불러오는 중: 티켓 로고의 이퀄라이저 막대가 오르내린다. index.html 의 첫 로딩 화면(#boot)과 같은 그림
// 본체(외곽 + 절취선 점)는 글자색, 막대는 바탕색으로 칠해 막대 높이만 움직인다 (.eq-bar, index.css)
const BODY = 'M48 44 H208 A24 24 0 0 1 232 68 V100 A22 22 0 0 0 232 144 V164 A24 24 0 0 1 208 188 H104 L60 224 V188 H48 A24 24 0 0 1 24 164 V68 A24 24 0 0 1 48 44 Z'
  + [69.2, 100.4, 131.6, 162.8].map((y) => ` M166 ${y} a6 6 0 1 0 12 0 a6 6 0 1 0 -12 0 Z`).join('')
const BARS = [{ x: 70, y: 92, h: 48 }, { x: 96, y: 78, h: 76 }, { x: 122, y: 98, h: 36 }]

export function LoadingMark({ size = 56 }: { size?: number }) {
  return (
    <svg viewBox="0 0 256 256" width={size} height={size} aria-hidden className="text-ink">
      <path fillRule="evenodd" fill="currentColor" d={BODY} />
      {BARS.map((b, i) => <rect key={b.x} className="eq-bar" style={{ animationDelay: `${i * 0.2}s` }} x={b.x} y={b.y} width="14" height={b.h} fill="var(--paper)" />)}
    </svg>
  )
}

export function Loading({ label = '불러오는 중...' }: { label?: string }) {
  return (
    <div role="status" className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 [animation:fade-in_200ms_ease-out_150ms_both]">
      <LoadingMark />
      <p className="t-sub font-medium text-graphite">{label}</p>
    </div>
  )
}
