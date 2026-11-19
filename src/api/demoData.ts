// 데모 모드(Supabase 미연결) 샘플 데이터. 공연은 "이번 달" 기준으로 만들어 캘린더에 항상 보이게 한다.
// 실제 공연 정보가 아니다.
import type { Artist, Concert, Genre } from './types'

export const GENRES: Genre[] = [
  { id: 1, name: '록' }, { id: 2, name: '인디' }, { id: 3, name: '메탈' }, { id: 4, name: '애니송' }, { id: 5, name: '아이돌' },
  { id: 6, name: '시티팝' }, { id: 7, name: '보카로' }, { id: 8, name: '힙합' }, { id: 9, name: '일렉트로닉' }, { id: 10, name: '발라드' },
]

export const ARTISTS: Artist[] = [
  { id: 'a1', name: '요아소비', nameJa: null, nameEn: 'YOASOBI' },
  { id: 'a2', name: '아이묭', nameJa: 'あいみょん', nameEn: 'Aimyon' },
  { id: 'a3', name: '요네즈 켄시', nameJa: '米津玄師', nameEn: 'Kenshi Yonezu' },
  { id: 'a4', name: '킹누', nameJa: null, nameEn: 'King Gnu' },
  { id: 'a5', name: '오피셜히게단디즘', nameJa: 'Official髭男dism', nameEn: 'Official HIGE DANdism' },
  { id: 'a6', name: '아도', nameJa: null, nameEn: 'Ado' },
  { id: 'a7', name: '래드윔프스', nameJa: null, nameEn: 'RADWIMPS' },
  { id: 'a8', name: '미세스 그린 애플', nameJa: null, nameEn: 'Mrs. GREEN APPLE' },
  { id: 'a9', name: '바운디', nameJa: null, nameEn: 'Vaundy' },
  { id: 'a10', name: '즛토마요', nameJa: 'ずっと真夜中でいいのに。', nameEn: 'ZUTOMAYO' },
  { id: 'a11', name: '원 오크 록', nameJa: null, nameEn: 'ONE OK ROCK' },
  { id: 'a12', name: '유우리', nameJa: '優里', nameEn: 'Yuuri' },
]

export type DemoUser = {
  id: string; nickname: string; bio: string; artistIds: string[]; genreIds: number[]
  favoriteIdx: number[]; willAccept: boolean; region?: string
}

export const DEMO_USERS: DemoUser[] = [
  { id: 'u1', nickname: '밤의소설', bio: '요아소비랑 즛토마요 라이브 같이 가요', artistIds: ['a1', 'a6', 'a10'], genreIds: [7, 4], favoriteIdx: [0, 7], willAccept: true, region: '서울' },
  { id: 'u2', nickname: '마리골드', bio: '아이묭 노래로 하루를 시작해요', artistIds: ['a2', 'a3', 'a9'], genreIds: [2, 10], favoriteIdx: [1], willAccept: true, region: '부산' },
  { id: 'u3', nickname: '하쿠기', bio: '킹누 공연은 무조건 스탠딩', artistIds: ['a4', 'a5'], genreIds: [1], favoriteIdx: [2], willAccept: false },
  { id: 'u4', nickname: '라이락', bio: '미세스 그린 애플 입덕 3년차', artistIds: ['a8', 'a12', 'a1'], genreIds: [5, 10], favoriteIdx: [6], willAccept: true },
  { id: 'u5', nickname: '전전전세', bio: '래드윔프스 내한 기다리는 중', artistIds: ['a7', 'a3'], genreIds: [1, 2], favoriteIdx: [5], willAccept: false },
  { id: 'u6', nickname: '우세모노', bio: 'Ado 목소리 실제로 듣고 싶어요', artistIds: ['a6', 'a1'], genreIds: [4, 7], favoriteIdx: [4], willAccept: true },
  { id: 'u7', nickname: '소란스러운밤', bio: '인디 밴드 위주로 들어요', artistIds: ['a10', 'a9', 'a2'], genreIds: [2], favoriteIdx: [7], willAccept: true },
  { id: 'u8', nickname: '나이트댄서', bio: '원오크 떼창하러 갈 사람', artistIds: ['a11', 'a4'], genreIds: [1, 3], favoriteIdx: [8], willAccept: true },
]

const NOL = 'https://nol.interpark.com/ticket'
const MELON = 'https://ticket.melon.com'
const YES24 = 'https://ticket.yes24.com'

// [month offset, days[], hour] → 이번 달 기준 KST 일정
type Seed = Omit<Concert, 'schedules' | 'ticketOpenAt' | 'id' | 'posterUrl' | 'genreId'> & { m: number; days: number[]; hour: number; genreId?: number }
const SEEDS: Seed[] = [
  { m: 0, days: [14, 15], hour: 18, title: 'YOASOBI ASIA TOUR in SEOUL', artistIds: ['a1'], venue: 'KSPO DOME', venueQuery: 'KSPO DOME', region: '서울', priceText: 'R석 143,000원, S석 132,000원', priceMin: 132000, priceMax: 143000, links: [{ vendor: 'NOL 티켓', url: NOL }], genreId: 7 },
  { m: 0, days: [22], hour: 18, title: 'あいみょん LIVE in KOREA', artistIds: ['a2'], venue: '인스파이어 아레나', venueQuery: '인스파이어 아레나', region: '인천', priceText: '전석 121,000원', priceMin: 121000, priceMax: 121000, links: [{ vendor: '멜론티켓', url: MELON }, { vendor: 'NOL 티켓', url: NOL }], genreId: 2 },
  { m: 0, days: [8, 9, 10], hour: 19, title: 'King Gnu Asia Tour Seoul', artistIds: ['a4'], venue: '올림픽공원 핸드볼경기장', venueQuery: '올림픽공원 핸드볼경기장', region: '서울', priceText: '스탠딩 132,000원', priceMin: 132000, priceMax: 132000, links: [{ vendor: '멜론티켓', url: MELON }], genreId: 1 },
  { m: 0, days: [5, 12, 13], hour: 18, title: 'Official髭男dism Live in Busan·Seoul', artistIds: ['a5'], venue: '벡스코 오디토리움', venueQuery: '벡스코', region: '부산', priceText: 'R석 154,000원, S석 121,000원', priceMin: 121000, priceMax: 154000, links: [{ vendor: 'YES24 티켓', url: YES24 }], genreId: 10 },
  { m: 0, days: [22], hour: 17, title: 'Ado WORLD TOUR Seoul', artistIds: ['a6'], venue: '고척스카이돔', venueQuery: '고척스카이돔', region: '서울', priceText: 'VIP석 165,000원, R석 143,000원', priceMin: 143000, priceMax: 165000, links: [{ vendor: 'NOL 티켓', url: NOL }, { vendor: '멜론티켓', url: MELON }], genreId: 4 },
  { m: 0, days: [27], hour: 18, title: 'RADWIMPS Live in Seoul', artistIds: ['a7'], venue: '블루스퀘어 SOL트래블홀', venueQuery: '블루스퀘어', region: '서울', priceText: '전석 99,000원', priceMin: 99000, priceMax: 99000, links: [{ vendor: 'NOL 티켓', url: NOL }], genreId: 1 },
  { m: 1, days: [6, 7], hour: 15, title: 'J-POP WINTER FES', artistIds: ['a8', 'a9', 'a12'], venue: '킨텍스 제2전시장', venueQuery: '킨텍스 제2전시장', region: '경기', priceText: '1일권 110,000원, 2일권 189,000원', priceMin: 110000, priceMax: 189000, links: [{ vendor: '멜론티켓', url: MELON }], genreId: 5 },
  { m: 1, days: [13], hour: 18, title: 'ZUTOMAYO Asia Tour Seoul', artistIds: ['a10'], venue: 'YES24 라이브홀', venueQuery: 'YES24 라이브홀', region: '서울', priceText: '스탠딩 88,000원', priceMin: 88000, priceMax: 88000, links: [{ vendor: 'YES24 티켓', url: YES24 }], genreId: 7 },
  { m: 1, days: [20, 21], hour: 18, title: 'ONE OK ROCK Asia Tour Seoul', artistIds: ['a11'], venue: 'KSPO DOME', venueQuery: 'KSPO DOME', region: '서울', priceText: 'R석 154,000원', priceMin: 154000, priceMax: 154000, links: [{ vendor: '멜론티켓', url: MELON }], genreId: 1 },
  { m: 1, days: [27], hour: 18, title: '米津玄師 Asia Tour Seoul', artistIds: ['a3'], venue: '고척스카이돔', venueQuery: '고척스카이돔', region: '서울', priceText: 'R석 165,000원, S석 143,000원', priceMin: 143000, priceMax: 165000, links: [{ vendor: 'NOL 티켓', url: NOL }], genreId: 2 },
  { m: 0, days: [3], hour: 19, title: 'Vaundy one man live', artistIds: ['a9'], venue: '무신사 개러지', venueQuery: '무신사 개러지', region: '서울', priceText: '스탠딩 77,000원', priceMin: 77000, priceMax: 77000, links: [{ vendor: 'NOL 티켓', url: NOL }], genreId: 2 },
  { m: 2, days: [10], hour: 18, title: 'Mrs. GREEN APPLE ASIA TOUR', artistIds: ['a8'], venue: '인스파이어 아레나', venueQuery: '인스파이어 아레나', region: '인천', priceText: 'R석 143,000원', priceMin: 143000, priceMax: 143000, links: [{ vendor: '멜론티켓', url: MELON }], genreId: 5 },
]

const kstParts = (ms: number) => {
  const [y, m] = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date(ms)).split('-').map(Number)
  return { y, m }
}

export function buildConcerts(now: number): Concert[] {
  const { y, m } = kstParts(now)
  return SEEDS.map((s, i) => {
    const month = new Date(Date.UTC(y, m - 1 + s.m, 1))
    const last = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate()
    const ym = `${month.getUTCFullYear()}-${String(month.getUTCMonth() + 1).padStart(2, '0')}`
    const schedules = s.days.map((d) => new Date(`${ym}-${String(Math.min(d, last)).padStart(2, '0')}T${String(s.hour).padStart(2, '0')}:00:00+09:00`).toISOString())
    const open = new Date(new Date(schedules[0]).getTime() - 21 * 86_400_000)
    open.setUTCHours(11, 0, 0, 0) // 20:00 KST
    const { m: _m, days: _d, hour: _h, genreId, ...rest } = s
    return { ...rest, id: `c${i + 1}`, posterUrl: null, genreId: genreId ?? null, schedules, ticketOpenAt: open.toISOString() }
  })
}

export const DEMO_POSTS = [
  { author: 'u1', title: '요아소비 첫날 스탠딩 후기', body: '사운드 정말 좋았어요. 앵콜 때 다 같이 부른 순간이 아직도 생생해요. 굿즈 줄은 2시간 전부터 길었어요.', tags: ['후기', '요아소비'] },
  { author: 'u4', title: '윈터 페스 2일권 고민 중이에요', body: '첫날 라인업이 더 끌리는데 둘째 날도 가 보신 분 계신가요? 이동 동선 팁도 궁금해요.', tags: ['질문', '페스'] },
  { author: 'u8', title: '원오크 떼창 연습곡 정리', body: 'The Beginning, Wherever you are, Clock Strikes 세 곡은 꼭 외워 가요!', tags: ['원오크', '정보'] },
  { author: 'u2', title: '아이묭 노래 중 최애 한 곡만 고른다면', body: '저는 마리골드요. 다들 한 곡씩 남겨 주세요.', tags: ['잡담', '아이묭'] },
  { author: 'u6', title: 'Ado 콘서트 응원봉 있나요?', body: '공식 응원봉이 따로 나오는지 아시는 분? 지난 투어 때는 판매했었다고 들었어요.', tags: ['질문', 'Ado'] },
]

export const AUTO_REPLIES = [
  '안녕하세요! 반가워요 :)',
  '저도 그 곡 진짜 좋아해요',
  '이번 공연 예매하셨어요?',
  '굿즈 줄 엄청 길 것 같아요 ㅠㅠ',
]
