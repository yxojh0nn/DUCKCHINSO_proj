// MusicBrainz(무료·CC0 데이터) 아티스트 검색과 이름 고르기 (docs/오픈API_조사.md 2장)
// sync-artists Edge Function 과 scripts(데모 데이터 받기) 공용. 이용 규칙: 초당 1회 이하 요청, 연락처가 담긴 User-Agent 필수
import { sleep } from './time.ts'

export type MbAlias = { name: string; locale?: string | null; primary?: boolean | null }
export type MbArtist = { id: string; name: string; aliases?: MbAlias[] }
export const MB_USER_AGENT = 'Duckchinso/0.1 ( https://github.com/Yeojh3261/DUCKCHINSO_proj )'

const pick = (aliases: MbAlias[] = [], locale: string) =>
  aliases.find((a) => a.locale === locale && a.primary)?.name ?? aliases.find((a) => a.locale === locale)?.name ?? null

// 한·일·영 이름. 한국어 별칭은 locale 없이 등록된 경우가 많아 한글이 든 별칭도 한국어 이름으로 쓴다
export const mbNames = (a: MbArtist) => ({
  ko: pick(a.aliases, 'ko') ?? a.aliases?.find((x) => /[가-힣]/.test(x.name))?.name ?? null,
  ja: pick(a.aliases, 'ja') ?? (/[぀-ヿ一-鿿]/.test(a.name) ? a.name : null),
  en: pick(a.aliases, 'en') ?? (/^[\x20-\x7e]+$/.test(a.name) ? a.name : null),
})

// j-pop·j-rock 태그의 일본 아티스트를 태그마다 최대 pages 쪽(쪽당 100명) 받는다. 쪽 사이 1.1초 (초당 1회 규칙)
// 요청이 몰리면 MusicBrainz 가 503 으로 잠깐 막는다: 3초 쉬고 retries 번까지 다시. 실패한 쪽을 돌려준 뒤 그 태그는 그만 받는다
export async function* mbPages(ua: string, pages: number, retries: number) {
  for (const tag of ['j-pop', 'j-rock']) {
    for (let page = 0; page < pages; page++) {
      const q = encodeURIComponent(`tag:"${tag}" AND country:JP`)
      const get = () => fetch(`https://musicbrainz.org/ws/2/artist?query=${q}&fmt=json&limit=100&offset=${page * 100}`, {
        headers: { 'User-Agent': ua, Accept: 'application/json' },
      })
      let res = await get()
      for (let i = 0; i < retries && res.status === 503; i++) { await sleep(3000); res = await get() }
      if (!res.ok) { yield { tag, page, ok: false, status: res.status, artists: [] as MbArtist[] }; break }
      const { artists = [] } = (await res.json()) as { artists?: MbArtist[] }
      yield { tag, page, ok: true, status: res.status, artists }
      await sleep(1100)
      if (artists.length < 100) break
    }
  }
}
