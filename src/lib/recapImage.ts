import { BADGE_TIERS, fileOf, tierIndex } from '@/components/MemberBadge'
import { LOGO_PATH } from '@/screens/auth/Wordmark'
import qrcode from 'qrcode-generator'
import { posterForCanvas } from './poster'
import { dayWithWeek, type Recap } from './recap'

// 리캡 카드 (SNS 스토리 비율 9:16, 1080×1920). 단색 바탕(기본 흑백, 저장 전에 파스텔 단색 선택) 위에 큰 날짜, 프로필, 다녀온 공연 목록.
// 화면 미리보기도 이 이미지를 그대로 쓴다 (모양이 하나라 화면과 저장본이 어긋나지 않음)
const S = 3
const W = 360
const H = 640
export const RECAP_MAX = 4 // 카드에 보이는 공연 수. 넘치면 "외 n개"
const FONT = '"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif'

// 카드 색: 기본은 흑백(앱 테마와 같은 무채색). 저장할 때 사용자가 단색 파스텔로 바꿀 수 있다 (그라데이션 없음)
//   chip: 포스터·프로필 사진이 없을 때 채우는 칸
export const RECAP_COLORS = [
  { id: 'mono', name: '흑백', bg: '#FFFFFF', ink: '#18181A', sub: 'rgba(24,24,26,0.58)', chip: '#F4F4F5', line: '#E4E4E7' },
  { id: 'black', name: '블랙', bg: '#18181A', ink: '#F4F4F5', sub: 'rgba(244,244,245,0.62)', chip: '#2C2C30', line: '#2C2C30' },
  { id: 'lavender', name: '라벤더', bg: '#E8E2FA', ink: '#2A2346', sub: 'rgba(42,35,70,0.62)', chip: '#F4F1FD', line: '#D9D1F3' },
  { id: 'peach', name: '피치', bg: '#FCE5D9', ink: '#4A2A1E', sub: 'rgba(74,42,30,0.62)', chip: '#FEF2EC', line: '#F3D3C2' },
  { id: 'mint', name: '민트', bg: '#DDF2E8', ink: '#173C30', sub: 'rgba(23,60,48,0.62)', chip: '#EEF9F3', line: '#C6E6D7' },
  { id: 'sky', name: '스카이', bg: '#DFEBFA', ink: '#1B2F4D', sub: 'rgba(27,47,77,0.62)', chip: '#EFF5FD', line: '#C9DBF2' },
  { id: 'butter', name: '버터', bg: '#FAF0CF', ink: '#45370F', sub: 'rgba(69,55,15,0.62)', chip: '#FDF8E7', line: '#EEE0B0' },
  { id: 'rose', name: '로즈', bg: '#FAE0E8', ink: '#4A1D2C', sub: 'rgba(74,29,44,0.62)', chip: '#FDF0F4', line: '#F0CAD6' },
] as const
export type RecapColor = (typeof RECAP_COLORS)[number]['id']
const colorOf = (id: RecapColor | undefined) => RECAP_COLORS.find((c) => c.id === id) ?? RECAP_COLORS[0]

// QR 칸 (true = 검은 칸)
export function qrModules(text: string) {
  const qr = qrcode(0, 'M')
  qr.addData(text)
  qr.make()
  const n = qr.getModuleCount()
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)))
}

// 그림 불러오기: 한 번 불러와 디코딩한 포스터·프로필·뱃지는 앱이 켜져 있는 동안 다시 쓴다 (카드를 다시 그릴 때 포스터가 대부분의 시간)
//   실패(null)는 담아 두지 않아 다음에 다시 시도한다
const images = new Map<string, Promise<HTMLImageElement | null>>()
const load = (src: string, cors: boolean) => {
  const hit = images.get(src)
  if (hit) return hit
  const p = new Promise<HTMLImageElement | null>((ok) => {
    const img = new Image()
    if (cors) img.crossOrigin = 'anonymous' // CORS 를 안 주는 이미지는 못 불러오고(null) 빈 칸으로 그린다. 캔버스가 오염돼 저장이 막히지 않게
    img.onload = () => img.decode().catch(() => {}).then(() => ok(img))
    img.onerror = () => ok(null)
    setTimeout(() => ok(null), 5000) // 포스터 서버가 늦으면 5초 뒤 빈 칸으로 그린다 (카드가 아예 안 나오지 않게). 다음에 다시 시도
    img.src = src
  })
  p.then((img) => { if (!img) images.delete(src) })
  if (images.size >= 80) images.delete(images.keys().next().value!) // 오래된 것부터 (포스터 80장이면 충분)
  images.set(src, p)
  return p
}

// 글자를 너비에 맞춰 최대 lines 줄로 자른다 (넘치면 …)
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, lines: number) {
  const out: string[] = []
  let cur = ''
  for (const ch of text) {
    if (ctx.measureText(cur + ch).width > width) { out.push(cur); cur = ch; if (out.length === lines) break } else cur += ch
  }
  if (out.length < lines && cur) out.push(cur)
  if (out.join('').length < [...text].length) {
    let last = out[lines - 1] ?? ''
    while (last && ctx.measureText(last + '…').width > width) last = last.slice(0, -1)
    out[lines - 1] = last + '…'
  }
  return out.slice(0, lines)
}

export type RecapCardOpts = {
  userId: string
  color?: RecapColor // 카드 색 (기본 흑백)
  nickname: string
  avatarUrl: string | null
  months: number | null // 뱃지 (구독 개월)
  qr: string | null // QR 에 담을 주소. null 이면 QR 없이
}

// 화면용 카드 캐시: 같은 리캡·같은 설정이면 다시 그리지 않고 만든 그림을 그대로 (JPEG, 장당 수백 KB). 저장은 늘 새로 PNG 로
const cards = new Map<string, Promise<Blob>>()
export function recapPreview(recap: Recap, o: RecapCardOpts): Promise<Blob> {
  const key = JSON.stringify([recap, o])
  const hit = cards.get(key)
  if (hit) { cards.delete(key); cards.set(key, hit); return hit } // 최근에 쓴 것을 뒤로 (오래된 것부터 버림)
  const p = recapImage(recap, o, 'image/jpeg')
  // 포스터가 늦어 빈 칸으로 그려졌으면 담아 두지 않는다 (다음에 열 때 포스터를 넣어 다시 그린다)
  const want = recap.items.slice(0, RECAP_MAX).flatMap((it) => (it.posterUrl ? [posterForCanvas(it.posterUrl)] : []))
  p.then(() => { if (want.some((u) => !images.has(u))) cards.delete(key) }, () => cards.delete(key))
  if (cards.size >= 24) cards.delete(cards.keys().next().value!)
  cards.set(key, p)
  return p
}

export async function recapImage(recap: Recap, o: RecapCardOpts, type: 'image/png' | 'image/jpeg' = 'image/png'): Promise<Blob> {
  await document.fonts?.ready
  const t = colorOf(o.color)
  const shown = recap.items.slice(0, RECAP_MAX)
  const more = recap.items.length - shown.length
  const cv = document.createElement('canvas')
  cv.width = W * S
  cv.height = H * S
  const ctx = cv.getContext('2d')!
  ctx.scale(S, S)
  const text = (s: string, x: number, y: number, size: number, weight: number, color: string, align: CanvasTextAlign = 'left', track = 0) => {
    ctx.font = `${weight} ${size}px ${FONT}`
    ctx.fillStyle = color
    ctx.textAlign = align
    ctx.letterSpacing = `${track}px`
    ctx.fillText(s, x, y)
    ctx.letterSpacing = '0px'
  }
  const round = (x: number, y: number, w: number, h: number, r: number) => { ctx.beginPath(); ctx.roundRect(x, y, w, h, r) }

  // 바탕: 단색 한 가지
  ctx.fillStyle = t.bg
  ctx.fillRect(0, 0, W, H)

  // 위: 앱 로고 + 덕친소 · (선택) QR
  ctx.save()
  ctx.translate(24, 29)
  ctx.scale(22 / 256, 22 / 256)
  ctx.fillStyle = t.ink
  ctx.fill(new Path2D(LOGO_PATH), 'evenodd')
  ctx.restore()
  text('덕친소', 51, 46, 15, 800, t.ink)
  if (o.qr) {
    const m = qrModules(o.qr)
    const box = 60
    const qx = W - 24 - box
    ctx.fillStyle = '#FFFFFF' // QR 은 어떤 색 카드에서도 흰 바탕·검은 칸 (인식률)
    round(qx, 24, box, box, 10); ctx.fill()
    const cell = (box - 10) / m.length
    ctx.fillStyle = '#18181A'
    m.forEach((row, r) => row.forEach((on, c) => { if (on) ctx.fillRect(qx + 5 + c * cell, 29 + r * cell, cell + 0.02, cell + 0.02) }))
  }

  // 큰 날짜: '2026년' / '11월' (연간은 '2026년' 한 줄)
  const monthly = recap.period.length === 7
  // 월간 '2026년 / 11월', 연간 '돌아보기 / 26’' — 같은 자리·같은 크기. 숫자는 기간(period)에서 나온다
  text(monthly ? `${recap.period.slice(0, 4)}년` : '돌아보기', 22, 150, 34, 800, t.ink, 'left', -1)
  text(monthly ? `${Number(recap.period.slice(5))}월` : `${recap.period.slice(2, 4)}’`, 20, 228, 84, 900, t.ink, 'left', -3)

  // 프로필 사진: 큰 날짜 오른쪽에 크게 (흰 테두리 원). 사진이 없으면 닉네임 첫 글자
  const AV = 72
  const ax = W - 24 - AV
  const ayc = 160 // 날짜 덩어리 높이 가운데쯤
  const av = o.avatarUrl ? await load(o.avatarUrl, true) : null
  ctx.fillStyle = t.line
  ctx.beginPath(); ctx.arc(ax + AV / 2, ayc + AV / 2, AV / 2 + 1.5, 0, Math.PI * 2); ctx.fill()
  ctx.save()
  ctx.beginPath(); ctx.arc(ax + AV / 2, ayc + AV / 2, AV / 2, 0, Math.PI * 2); ctx.clip()
  ctx.fillStyle = t.chip
  ctx.fillRect(ax, ayc, AV, AV)
  if (av) {
    const k = Math.max(AV / av.width, AV / av.height)
    ctx.drawImage(av, ax + (AV - av.width * k) / 2, ayc + (AV - av.height * k) / 2, av.width * k, av.height * k)
  } else text(o.nickname.trim().charAt(0) || '?', ax + AV / 2, ayc + AV / 2 + 11, 30, 800, t.ink, 'center')
  ctx.restore()

  // 닉네임 + 뱃지 (날짜 아래 작게)
  const ny = 263
  ctx.font = `600 15px ${FONT}`
  let nick = o.nickname
  while (nick.length > 1 && ctx.measureText(nick).width > 260) nick = nick.slice(0, -1)
  if (nick !== o.nickname) nick += '…'
  text(nick, 24, ny, 15, 600, t.ink)
  if (o.months != null) {
    const badge = await load(fileOf(BADGE_TIERS[tierIndex(o.months)].min, true), false)
    if (badge) ctx.drawImage(badge, 24 + ctx.measureText(nick).width + 6, ny - 13, 17, 17)
  }

  // 다녀온 공연: 번호 · 포스터 · 공연 · 일시
  text('다녀온 공연', 24, 312, 13, 700, t.sub, 'left', 0.5)
  text(`${recap.items.length}`, W - 24, 312, 13, 700, t.sub, 'right')
  const posters = await Promise.all(shown.map((it) => (it.posterUrl ? load(posterForCanvas(it.posterUrl), true) : Promise.resolve(null))))
  shown.forEach((it, i) => {
    const y = 326 + i * 70
    text(String(i + 1), 24, y + 36, 15, 800, t.sub)
    const px = 46
    ctx.save()
    round(px, y, 42, 60, 7); ctx.clip()
    ctx.fillStyle = t.chip
    ctx.fillRect(px, y, 42, 60)
    const p = posters[i]
    if (p) { // object-cover
      const k = Math.max(42 / p.width, 60 / p.height)
      ctx.drawImage(p, px + (42 - p.width * k) / 2, y + (60 - p.height * k) / 2, p.width * k, p.height * k)
    }
    ctx.restore()
    const tx = px + 42 + 14
    ctx.font = `700 15px ${FONT}`
    const lines = wrap(ctx, it.title, W - 24 - tx, 2)
    let ty = y + (lines.length === 1 ? 26 : 18)
    lines.forEach((l) => { text(l, tx, ty, 15, 700, t.ink); ty += 19 })
    text(`${dayWithWeek(it.day)}${it.time ? ` ${it.time}` : ''}`, tx, ty + 1, 12.5, 500, t.sub)
  })
  if (more > 0) text(`외 ${more}개 공연`, 24, 326 + shown.length * 70 + 16, 13, 700, t.sub)

  return new Promise((ok, fail) => cv.toBlob((b) => (b ? ok(b) : fail(new Error('image_failed'))), type, 0.92))
}
