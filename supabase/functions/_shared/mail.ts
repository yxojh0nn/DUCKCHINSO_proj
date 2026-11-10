// 메일 발송 (Resend, https://resend.com). RESEND_API_KEY 가 없거나 받을 수 없는 주소(카카오 자리 채움)면 보내지 않고 false
import { NO_MAIL_DOMAIN } from './providers.ts'

export const canMail = (to?: string | null) => !!Deno.env.get('RESEND_API_KEY') && !!to && !to.endsWith(`@${NO_MAIL_DOMAIN}`)

export async function sendMail(to: string | null | undefined, subject: string, text: string) {
  if (!canMail(to)) return false
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${Deno.env.get('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: Deno.env.get('MAIL_FROM') ?? '덕친소 <noreply@duckchinso.app>', to, subject, text }),
  })
  return res.ok
}
