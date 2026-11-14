// 오픈 API 응답 → 앱 데이터(src/api/types.ts 모양). 네트워크 없는 순수 함수만 둔다 (openData.test.ts 로 확인)
import type { Artist, Concert } from '../src/api/types.ts'
import { norm, parsePrice, expandSchedule, shortRegion, type KopisDetail } from '../supabase/functions/_shared/kopis.ts'
import { mbNames, type MbArtist } from '../supabase/functions/_shared/musicbrainz.ts'

export type KeyedArtist = Artist & { names: string[] } // names: KOPIS 공연명 대조용 (한·일·영·별칭)

// 이름 규칙은 sync-artists 함수와 같은 mbNames (_shared/musicbrainz.ts)
export const fromMusicBrainz = (a: MbArtist): KeyedArtist => {
  const { ko, ja, en } = mbNames(a)
  const names = [...new Set([a.name, ko, ja, en, ...(a.aliases ?? []).map((x) => x.name)].filter(Boolean) as string[])].slice(0, 24)
  return { id: `mb:${a.id}`, name: ko ?? a.name, nameJa: ja, nameEn: en, names }
}

// 데모 아티스트(데모 사용자가 이미 고른 id)를 살리고, 같은 사람인 MusicBrainz 아티스트는 이름·별칭만 보탠다
export const mergeArtists = (base: Artist[], mb: KeyedArtist[]): KeyedArtist[] => {
  const out: KeyedArtist[] = base.map((a) => ({ ...a, names: [a.name, a.nameJa, a.nameEn].filter(Boolean) as string[] }))
  for (const m of mb) {
    const keys = new Set(m.names.map(norm))
    const same = out.find((a) => a.names.some((n) => keys.has(norm(n))))
    if (same) same.names = [...new Set([...same.names, ...m.names])]
    else out.push(m)
  }
  return out
}

// KOPIS 상세 → Concert. 회차는 KST 로 읽어 UTC ISO 로 저장 (supabaseApi.listConcerts 와 같은 모양)
export const toConcert = (d: KopisDetail, artistIds: string[]): Concert => {
  const [priceMin, priceMax] = parsePrice(d.priceText)
  return {
    id: `kopis:${d.id}`, title: d.title,
    posterUrl: d.poster ? d.poster.replace(/^http:\/\//, 'https://') : null, // 배포 웹(https)에서 섞인 콘텐츠로 막히지 않게
    venue: d.venue, venueQuery: d.venue, region: shortRegion(d.area) || null,
    priceText: d.priceText || null, priceMin, priceMax,
    ticketOpenAt: null, // KOPIS 에 없음 (운영자 입력, docs/오픈API_조사.md 4장)
    genreId: null, artistIds,
    schedules: expandSchedule(d.from, d.to, d.schedule).map((s) => new Date(`${s}:00+09:00`).toISOString()).sort(),
    links: d.links,
  }
}
