// 메일 발송 (Resend, https://resend.com). RESEND_API_KEY 가 없거나 받을 수 없는 주소(카카오 자리 채움)면 보내지 않고 false

export const canMail = (to?: string | null) => !!Deno.env.get('RESEND_API_KEY') && !!to && !/@kakao\.noemail\.duckchinso\.(com|app)$/i.test(to)

export async function sendMail(to: string | null | undefined, subject: string, text: string) {
  if (!canMail(to)) return false
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: Deno.env.get('MAIL_FROM') ?? '덕친소 <noreply@duckchinso.com>', to, subject, text }),
  })
  // 실패 원인만 남긴다 (받는 주소·본문은 남기지 않음). Supabase > Edge Functions > 해당 함수 > Logs 에서 'mail_failed' 검색
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { name?: string }
    console.error('mail_failed', res.status, err.name ?? 'unknown', subject)
  }
  return res.ok
}
