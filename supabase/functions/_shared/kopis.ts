// KOPIS 응답(XML) 파싱과 J-pop 판별. 런타임 의존이 없는 순수 함수만 둔다 (kopis.test.ts 로 확인)

export type KopisListItem = { id: string; title: string; from: string; to: string; venue: string; poster: string; area: string }
export type KopisDetail = KopisListItem & {
  cast: string; priceText: string; schedule: string; links: { vendor: string; url: string }[]
}
export type ArtistKey = { id: string; names: string[] }

const decode = (s: string) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .trim()

export const tag = (xml: string, name: string) => {
  const m = xml.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))
  return m ? decode(m[1]) : ''
}
const blocks = (xml: string, name: string) => [...xml.matchAll(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`, 'g'))].map((m) => m[1])

const toIso = (d: string) => d.replace(/\./g, '-') // 2026.11.14 → 2026-11-14

export const parseList = (xml: string): KopisListItem[] =>
  blocks(xml, 'db').map((b) => ({
    id: tag(b, 'mt20id'), title: tag(b, 'prfnm'), from: toIso(tag(b, 'prfpdfrom')), to: toIso(tag(b, 'prfpdto')),
    venue: tag(b, 'fcltynm'), poster: tag(b, 'poster'), area: tag(b, 'area'),
  }))

export const parseDetail = (xml: string): KopisDetail => {
  const b = blocks(xml, 'db')[0] ?? ''
  return {
    id: tag(b, 'mt20id'), title: tag(b, 'prfnm'), from: toIso(tag(b, 'prfpdfrom')), to: toIso(tag(b, 'prfpdto')),
    venue: tag(b, 'fcltynm'), poster: tag(b, 'poster'), area: tag(b, 'area'),
    cast: tag(b, 'prfcast'), priceText: tag(b, 'pcseguidance'), schedule: tag(b, 'dtguidance'),
    links: blocks(b, 'relate').map((r) => ({ vendor: tag(r, 'relatenm'), url: tag(r, 'relateurl') }))
      .filter((l) => /^https?:\/\//.test(l.url)),
  }
}

// "VIP석 154,000원, R석 132,000원" → [132000, 154000]
export const parsePrice = (s: string): [number | null, number | null] => {
  const n = [...s.matchAll(/([\d,]{3,})\s*원/g)].map((m) => Number(m[1].replace(/,/g, ''))).filter((x) => x > 0)
  return n.length ? [Math.min(...n), Math.max(...n)] : [null, null]
}

const DAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']

// dtguidance 예: "토요일(18:00), 일요일(17:00)" · "화요일 ~ 금요일(20:00), 토요일 ~ 일요일(15:00,19:00)"
// 공연 기간 안의 날짜 중 요일이 맞는 날마다 회차를 만든다. 반환값은 KST 기준 "YYYY-MM-DDTHH:mm"
export const expandSchedule = (from: string, to: string, guide: string): string[] => {
  const byDay = new Map<number, string[]>()
  for (const m of guide.matchAll(/([^(),]+?)\s*\(([\d:,\s]+)\)/g)) {
    const times = m[2].split(',').map((t) => t.trim()).filter((t) => /^\d{1,2}:\d{2}$/.test(t)).map((t) => t.padStart(5, '0'))
    const range = m[1].split('~').map((s) => DAYS.indexOf(s.trim()))
    if (range.some((d) => d < 0) || !times.length) continue
    const [a, b = a] = range
    for (let d = a; ; d = (d + 1) % 7) {
      byDay.set(d, [...(byDay.get(d) ?? []), ...times])
      if (d === b) break
    }
  }
  const out: string[] = []
  const end = new Date(`${to}T00:00:00Z`).getTime()
  for (let t = new Date(`${from}T00:00:00Z`).getTime(); t <= end && out.length < 60; t += 86_400_000) {
    const date = new Date(t).toISOString().slice(0, 10)
    const times = byDay.get(new Date(t).getUTCDay()) ?? (byDay.size ? [] : ['19:00']) // 안내 문구를 못 읽으면 19시로 둔다
    times.forEach((tm) => out.push(`${date}T${tm}`))
  }
  return out
}

const norm = (s: string) => s.toLowerCase().normalize('NFKC').replace(/[\s.·'’!?\-_]/g, '')

// 공연명·출연진에 등록된 아티스트 이름(한·일·영·별칭)이 들어 있으면 그 아티스트의 공연으로 본다
export const matchArtists = (text: string, artists: ArtistKey[]) => {
  const t = norm(text)
  return artists.filter((a) => a.names.some((n) => norm(n).length >= 2 && t.includes(norm(n)))).map((a) => a.id)
}

// 아티스트는 못 찾았지만 J-pop 내한일 가능성이 있는 공연 → 운영자 검수 대기
export const looksJapanese = (text: string) =>
  /j-?pop|japan|재팬|일본|내한|[぀-ヿ]/i.test(text)

export const shortRegion = (area: string) =>
  area.replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, '').replace(/^(충청북|충북)$/, '충북').replace(/^(충청남)$/, '충남')
    .replace(/^(전라북|전북)$/, '전북').replace(/^(전라남)$/, '전남').replace(/^(경상북)$/, '경북').replace(/^(경상남)$/, '경남')
