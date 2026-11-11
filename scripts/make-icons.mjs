// 대체 아이콘 만들기: design/og/icon.html → public/apple-touch-icon.png(180), public/favicon.ico(16·32·48)
// Chrome 헤드리스로 크기별 PNG 를 찍고, ICO 는 PNG 를 그대로 담는 형식으로 묶는다 (추가 패키지 없음)
// 실행: node scripts/make-icons.mjs   (CHROME 환경변수로 Chrome 경로를 바꿀 수 있다)
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const chrome = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe'
const src = pathToFileURL(resolve('design/og/icon.html')).href
const tmp = mkdtempSync(join(tmpdir(), 'icons-'))

const shot = (size, round) => {
  const out = join(tmp, `${size}${round ? 'r' : ''}.png`)
  execFileSync(chrome, ['--headless', '--disable-gpu', '--hide-scrollbars', '--default-background-color=00000000',
    `--window-size=${size},${size}`, `--screenshot=${out}`, `${src}?s=${size}${round ? '&r=1' : ''}`], { stdio: 'ignore' })
  const png = readFileSync(out)
  const w = png.readUInt32BE(16), h = png.readUInt32BE(20)
  if (w !== size || h !== size) throw new Error(`${size}px 를 찍었는데 ${w}×${h} 가 나왔다 (Chrome 최소 창 크기 확인)`)
  return png
}

// ICO: 머리 6바이트 + 이미지마다 16바이트 목록 + PNG 원본들
const ico = (pngs) => {
  const head = Buffer.alloc(6 + 16 * pngs.length)
  head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(pngs.length, 4)
  let offset = head.length
  pngs.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i
    head.writeUInt8(size >= 256 ? 0 : size, e); head.writeUInt8(size >= 256 ? 0 : size, e + 1)
    head.writeUInt16LE(1, e + 4); head.writeUInt16LE(32, e + 6)
    head.writeUInt32LE(data.length, e + 8); head.writeUInt32LE(offset, e + 12)
    offset += data.length
  })
  return Buffer.concat([head, ...pngs.map((p) => p.data)])
}

writeFileSync('public/apple-touch-icon.png', shot(180, false))
writeFileSync('public/favicon.ico', ico([16, 32, 48].map((size) => ({ size, data: shot(size, true) }))))
console.log('public/apple-touch-icon.png, public/favicon.ico 만들었어요')
