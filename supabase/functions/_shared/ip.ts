// 요청한 사람의 IP — 속도 제한 키로만 쓴다 (보안 감사 #2)
// x-forwarded-for 의 첫 값은 클라이언트가 보낸 그대로라 위조된다. 앞단(Cloudflare·게이트웨이)이 붙이는 값만 믿는다:
//   1) cf-connecting-ip: Cloudflare 가 덮어써서 클라이언트가 바꿀 수 없다
//   2) 없으면 x-forwarded-for 의 마지막 값: 게이트웨이가 실제 접속 IP 를 뒤에 덧붙인다
// 운영 확인: 'client_ip_source' 로그가 cf 인지 본다. xff 만 나오면 마지막 값이 내부 프록시 IP 는 아닌지 확인한다
let logged = false
export function clientIp(h: Headers): string {
  const cf = h.get('cf-connecting-ip')?.trim()
  const xff = h.get('x-forwarded-for')?.split(',').map((s) => s.trim()).filter(Boolean).at(-1)
  if (!logged) { logged = true; console.log('client_ip_source', cf ? 'cf' : xff ? 'xff' : 'none') } // 값(IP)은 남기지 않는다
  return cf || xff || 'unknown'
}
