// 서비스 이름 표기. 글자 자체를 로고로 쓴다 (두 글자 사이 티켓 절취선)
export function Wordmark({ small }: { small?: boolean }) {
  return (
    <p aria-label="덕친소" className={`flex items-center font-extrabold tracking-[-0.04em] ${small ? 'text-[26px]' : 'text-[44px]'}`}>
      <span aria-hidden>덕친</span>
      <span aria-hidden className={`mx-1.5 border-l-2 border-dashed border-ink/40 ${small ? 'h-6' : 'h-10'}`} />
      <span aria-hidden>소</span>
    </p>
  )
}
