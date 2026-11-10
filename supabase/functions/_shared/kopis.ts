// KOPIS 응답(XML) 파싱과 J-pop 판별. 런타임 의존이 없는 순수 함수만 둔다 (kopis.test.ts 로 확인)

export type KopisListItem = { id: string; title: string; from: string; to: string; venue: string; poster: string; area: string }
export type KopisDetail = KopisListItem & {
  cast: string; priceText: string; schedule: string; links: { vendor: string; url: string }[]
  visit: boolean // 내한 공연 여부 (KOPIS visit=Y)
  promoter: string // 제작·기획·주최·주관사 (중복 제거, 쉼표로)
  intro: string[] // 소개 이미지(styurls) 주소 — 포스터보다 큰 상세 안내 이미지
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

// fcltynm 은 "공연장 (세부홀)" 모양인데, 두 이름이 같으면 한 번만: "롤링홀 (롤링홀)" → "롤링홀"
export const cleanVenue = (v: string) => {
  const t = v.replace(/\s+/g, ' ').replace(/\(\s/g, '(').replace(/\s\)/g, ')').trim()
  const x = t.slice(0, (t.length - 3) / 2) // 이름 안에도 괄호가 있을 수 있어 정규식 대신 길이로 반을 나눈다
  return t === `${x} (${x})` ? x : t
}

export const parseList = (xml: string): KopisListItem[] =>
  blocks(xml, 'db').map((b) => ({
    id: tag(b, 'mt20id'), title: tag(b, 'prfnm'), from: toIso(tag(b, 'prfpdfrom')), to: toIso(tag(b, 'prfpdto')),
    venue: cleanVenue(tag(b, 'fcltynm')), poster: tag(b, 'poster'), area: tag(b, 'area'),
  }))

export const parseDetail = (xml: string): KopisDetail => {
  const b = blocks(xml, 'db')[0] ?? ''
  return {
    id: tag(b, 'mt20id'), title: tag(b, 'prfnm'), from: toIso(tag(b, 'prfpdfrom')), to: toIso(tag(b, 'prfpdto')),
    venue: cleanVenue(tag(b, 'fcltynm')), poster: tag(b, 'poster'), area: tag(b, 'area'),
    cast: tag(b, 'prfcast'), priceText: tag(b, 'pcseguidance'), schedule: tag(b, 'dtguidance'),
    visit: tag(b, 'visit') === 'Y',
    promoter: [...new Set(['entrpsnm', 'entrpsnmP', 'entrpsnmA', 'entrpsnmH', 'entrpsnmS']
      .flatMap((k) => tag(b, k).split(',')).map((x) => x.trim()).filter(Boolean))].join(', '),
    links: blocks(b, 'relate').map((r) => ({ vendor: tag(r, 'relatenm'), url: tag(r, 'relateurl') }))
      .filter((l) => /^https?:\/\//.test(l.url)),
    intro: blocks(b, 'styurl').map((u) => u.trim()).filter((u) => /^https?:\/\//.test(u)),
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

// 같은 이름·공연명을 수십만 번 정규화하지 않도록 결과를 기억한다
// (아티스트 800명 × 공연 700건이면 Edge Function CPU 한도를 넘는다. 2026-11-04 WORKER_RESOURCE_LIMIT)
const memo = <T>(f: (s: string) => T) => {
  const m = new Map<string, T>()
  return (s: string) => {
    if (!m.has(s)) m.set(s, f(s))
    return m.get(s)!
  }
}

export const norm = memo((s) => s.toLowerCase().normalize('NFKC').replace(/[\s.·'’!?\-_]/g, ''))

const NON_LATIN = /[가-힣぀-ヿ一-鿿]/
const wordsOf = memo((text) => ` ${text.toLowerCase().normalize('NFKC').replace(/[^a-z0-9가-힣぀-ヿ一-鿿]+/g, ' ')} `)
// 영문 이름이면 단어로 쪼갠 소문자 형태, 한글·일본어가 섞이면 null
const latinWords = memo((raw) => {
  const n = raw.normalize('NFKC')
  return NON_LATIN.test(n) ? null : n.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
})

// 이름이 글에 들어 있는지와 그 이름의 강도. strong: 여러 단어·8자 이상 영문, 3글자 이상 한글·일본어 / weak: 짧은 한 단어 영문
// 영문은 단어 단위로만 (Eve ≠ Event). 전각 ＢＥＧＩＮ·곡선 따옴표 Mu’s 도 NFKC 로 바꿔 영문 규칙으로. 두 글자 한글·일본어는 쓰지 않는다
type Hit = { strong: boolean; oneWord: boolean }
const nameHit = (raw: string, text: string): Hit | null => {
  const w = latinWords(raw)
  if (w !== null) {
    if (w.length < 2 || !wordsOf(text).includes(` ${w} `)) return null
    const oneWord = !w.includes(' ')
    return { strong: !oneWord || w.length >= 8, oneWord }
  }
  const k = norm(raw)
  return k.length >= 3 && norm(text).includes(k) ? { strong: true, oneWord: false } : null
}

// 두 단어 이름은 앞뒤를 바꾼 표기도 같은 사람으로 본다 (MusicBrainz "켄시 요네즈" ↔ KOPIS "요네즈 켄시")
const withSwapped = (names: string[]) =>
  names.flatMap((n) => { const p = n.trim().split(/\s+/); return p.length === 2 ? [n, `${p[1]} ${p[0]}`] : [n] })

// 출연진 칸의 한 사람이 일본 이름 표기처럼 보이는가 (카와사키 타카야, 요네즈 켄시)
// 일본어 표기는 받침이 ㄴ 뿐이고 ㅐ·ㅡ(스·즈·츠 제외) 같은 모음을 거의 안 쓴다. 영미권 이름(스테이시 켄트, 프레야 스카이)은 트·프·앤 에서 걸러진다
const japaneseName = (person: string) => {
  const parts = person.trim().split(/\s+/)
  if (parts.length < 2 || parts.length > 3) return false
  const syl = parts.join('')
  if (syl.length < 4 || !/^[가-힣]+$/.test(syl)) return false
  return [...syl].every((ch) => {
    const c = ch.charCodeAt(0) - 0xac00
    const jong = c % 28, jung = Math.floor(c / 28) % 21, cho = Math.floor(c / 588)
    if (jong !== 0 && jong !== 4) return false // 받침은 없거나 ㄴ
    if ([1, 3, 7, 10, 11, 14, 15, 16, 19].includes(jung)) return false // ㅐㅒㅖㅚㅟㅞㅝㅢ
    if (jung === 18 && ![9, 12, 14].includes(cho)) return false // ㅡ 는 스·즈·츠 만
    return true
  })
}

// J-pop 공연을 연 기획사 기본값. 실서비스는 jpop_promoters 표(운영자가 공연을 게시할 때 쌓임)를 넘겨받는다
export const JPOP_PROMOTERS = ['위트', 'weete', '원더로크', '리벳', 'LIVET', '지누락', '하이징크스', 'HIGHJINKX', '아뮤즈']

export type Verdict = { decision: 'publish' | 'review' | 'skip'; score: number; artistIds: string[]; reasons: string[] }
type Judged = Pick<KopisDetail, 'title' | 'cast' | 'visit' | 'promoter' | 'area'>

// J-pop 공연 판별 (docs/오픈API_조사.md 1장, 점수제). 4점 이상 게시 · 2~3점 검수 대기 · 그 밖은 제외
// 아티스트를 못 찾아도 내한 공연이면서 일본 공연 신호가 있으면 검수 대기 (MusicBrainz 목록에 없는 아티스트를 놓치지 않게)
export const judgeConcert = (d: Judged, artists: ArtistKey[], promoters: string[] = JPOP_PROMOTERS): Verdict => {
  if (d.area === '해외' || /\[일본/.test(d.title)) return { decision: 'skip', score: 0, artistIds: [], reasons: ['해외 공연'] }
  const people = d.cast.split(/[,，、/]/).map((p) => p.replace(/\s*등\s*$/, '').trim()).filter(Boolean)
  const jpTitle = /j-?pop|japan|재팬|일본|도쿄|tokyo|오사카|osaka|[぀-ヿ一-鿿]/i.test(d.title)
  const jpCast = people.some(japaneseName)
  const promoter = promoters.some((p) => d.promoter.toLowerCase().includes(p.toLowerCase()))
  const base: [number, string][] = []
  if (d.visit) base.push([2, '내한 +2'])
  if (jpTitle || jpCast) base.push([1, jpTitle ? '일본 표기 +1' : '일본식 출연진 이름 +1'])
  if (promoter) base.push([1, 'J-pop 기획사 +1'])

  const scored = artists.map((a) => {
    const reasons: string[] = []
    let s = 0
    const names = withSwapped(a.names)
    const castExact = names.some((n) => norm(n).length >= 2 && people.some((p) => norm(p) === norm(n)))
    if (castExact) { s += 3; reasons.push('출연진 정확 일치 +3') }
    const hits = names.map((n) => nameHit(n, d.title)).filter((h): h is Hit => !!h)
    const strong = hits.some((h) => h.strong)
    if (strong) { s += 2; reasons.push('공연명에 고유한 이름 +2') }
    else if (hits.length) { s += 1; reasons.push('공연명에 짧은 이름 +1') }
    if (!castExact && !hits.length) return null
    // 출연진이 적혀 있는데 그 아티스트가 없고, 공연명에서 한 단어 영문 이름으로만 맞았다 → 다른 사람일 가능성 (AFTERGLOW, LISA ONO)
    // 단, 출연진이 일본 이름 표기이고 공연명 이름이 고유하면 같은 사람의 한글 표기로 본다 (KORESAWA ↔ 코레사와 하시미)
    if (!castExact && people.length && hits.every((h) => h.oneWord) && !(jpCast && strong)) { s -= 3; reasons.push('출연진에 없음 −3') }
    if (!d.visit && !castExact && !strong) { s -= 2; reasons.push('국내 공연에 짧은 이름뿐 −2') }
    return { id: a.id, s, reasons }
  }).filter((x): x is { id: string; s: number; reasons: string[] } => !!x)

  const bonus = base.reduce((n, [v]) => n + v, 0)
  const best = scored.length ? Math.max(...scored.map((x) => x.s)) + bonus : 0
  const top = scored.filter((x) => x.s + bonus >= 2)
  const reasons = [...(scored.find((x) => x.s + bonus === best)?.reasons ?? []), ...base.map(([, r]) => r)]
  if (top.length && best >= 4) return { decision: 'publish', score: best, artistIds: top.map((x) => x.id), reasons }
  if (top.length && best >= 2) return { decision: 'review', score: best, artistIds: top.map((x) => x.id), reasons }
  if ((d.visit && (jpTitle || jpCast || promoter)) || /[぀-ヿ]/.test(d.title)) return { decision: 'review', score: bonus, artistIds: [], reasons: [...base.map(([, r]) => r), '아티스트 미등록'] }
  return { decision: 'skip', score: best, artistIds: [], reasons }
}

// 상세를 받아 볼 후보: 공연명에 아티스트 이름이 글자 그대로 들어 있거나(3글자 이상), 일본·내한 표시가 있는 공연. 판정은 judgeConcert 가 한다
export const isCandidate = (title: string, artists: ArtistKey[]) =>
  looksJapanese(title) || artists.some((a) => a.names.some((n) => norm(n).length >= 3 && norm(title).includes(norm(n))))

// 아티스트는 못 찾았지만 J-pop 내한일 가능성이 있는 공연 → 운영자 검수 대기
export const looksJapanese = (text: string) =>
  /j-?pop|japan|재팬|일본|내한|[぀-ヿ]/i.test(text)

export const shortRegion = (area: string) =>
  area.replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, '').replace(/^(충청북|충북)$/, '충북').replace(/^(충청남)$/, '충남')
    .replace(/^(전라북|전북)$/, '전북').replace(/^(전라남)$/, '전남').replace(/^(경상북)$/, '경북').replace(/^(경상남)$/, '경남')
