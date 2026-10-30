// 프로토타입용 샘플 데이터. Supabase 연결 시 이 파일 대신 DB 조회로 바꾼다.
// 공연 일정·장소는 화면 확인용 가상 데이터이며 실제 공연 정보가 아니다.

export type Artist = { id: string; name: string; nameJa: string }

export type TicketLink = { vendor: string; url: string }

export type Concert = {
  id: string
  title: string
  artistIds: string[]
  startsAt: string // ISO, UTC 기준 저장 (기획서 3.4 timestamptz 규칙)
  ticketOpenAt: string
  venue: string
  venueQuery: string // 지도 앱 검색어
  region: string
  ticketLinks: TicketLink[]
}

export type MockUser = {
  id: string
  nickname: string
  region: string
  artistIds: string[]
  regionPublic: boolean
  willAccept: boolean // 데모: 내가 요청을 보내면 수락할지
}

export const REGIONS = [
  '서울', '부산', '대구', '인천', '광주', '대전', '울산', '세종', '경기',
  '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
] as const

// Apple Music API 연결 전 임시 목록 (API 사용 불가 시 이 목록은 비우고 보류)
export const ARTISTS: Artist[] = [
  { id: 'a1', name: '요아소비', nameJa: 'YOASOBI' },
  { id: 'a2', name: '아이묭', nameJa: 'あいみょん' },
  { id: 'a3', name: '요네즈 켄시', nameJa: '米津玄師' },
  { id: 'a4', name: '킹누', nameJa: 'King Gnu' },
  { id: 'a5', name: '오피셜히게단디즘', nameJa: 'Official髭男dism' },
  { id: 'a6', name: '아도', nameJa: 'Ado' },
  { id: 'a7', name: '래드윔프스', nameJa: 'RADWIMPS' },
  { id: 'a8', name: '미세스 그린 애플', nameJa: 'Mrs. GREEN APPLE' },
  { id: 'a9', name: '바운디', nameJa: 'Vaundy' },
  { id: 'a10', name: '즛토마요', nameJa: 'ずっと真夜中でいいのに。' },
  { id: 'a11', name: '원 오크 록', nameJa: 'ONE OK ROCK' },
  { id: 'a12', name: '유우리', nameJa: '優里' },
]

const MELON = 'https://ticket.melon.com'
const NOL = 'https://nol.interpark.com/ticket'
const YES24 = 'https://ticket.yes24.com'

// KST 시각을 UTC ISO로 바꾼다
const kst = (s: string) => new Date(`${s}:00+09:00`).toISOString()

export const CONCERTS: Concert[] = [
  {
    id: 'c1', title: 'YOASOBI ASIA TOUR in SEOUL', artistIds: ['a1'],
    startsAt: kst('2026-11-14T18:00'), ticketOpenAt: kst('2026-10-20T20:00'),
    venue: 'KSPO DOME', venueQuery: 'KSPO DOME', region: '서울',
    ticketLinks: [{ vendor: 'NOL 티켓', url: NOL }],
  },
  {
    id: 'c2', title: 'YOASOBI ASIA TOUR in SEOUL (2일차)', artistIds: ['a1'],
    startsAt: kst('2026-11-15T17:00'), ticketOpenAt: kst('2026-10-20T20:00'),
    venue: 'KSPO DOME', venueQuery: 'KSPO DOME', region: '서울',
    ticketLinks: [{ vendor: 'NOL 티켓', url: NOL }],
  },
  {
    id: 'c3', title: 'あいみょん LIVE in KOREA', artistIds: ['a2'],
    startsAt: kst('2026-11-22T18:00'), ticketOpenAt: kst('2026-11-03T20:00'),
    venue: '인스파이어 아레나', venueQuery: '인스파이어 아레나', region: '인천',
    ticketLinks: [{ vendor: '멜론티켓', url: MELON }, { vendor: 'NOL 티켓', url: NOL }],
  },
  {
    id: 'c4', title: 'King Gnu Asia Tour Seoul', artistIds: ['a4'],
    startsAt: kst('2026-11-28T19:00'), ticketOpenAt: kst('2026-11-05T20:00'),
    venue: '올림픽공원 핸드볼경기장', venueQuery: '올림픽공원 핸드볼경기장', region: '서울',
    ticketLinks: [{ vendor: '멜론티켓', url: MELON }],
  },
  {
    id: 'c5', title: 'Official髭男dism Live in Busan', artistIds: ['a5'],
    startsAt: kst('2026-12-05T18:00'), ticketOpenAt: kst('2026-11-10T20:00'),
    venue: '벡스코 오디토리움', venueQuery: '벡스코', region: '부산',
    ticketLinks: [{ vendor: 'YES24 티켓', url: YES24 }],
  },
  {
    id: 'c6', title: 'Ado WORLD TOUR Seoul', artistIds: ['a6'],
    startsAt: kst('2026-12-12T18:00'), ticketOpenAt: kst('2026-11-12T20:00'),
    venue: '고척스카이돔', venueQuery: '고척스카이돔', region: '서울',
    ticketLinks: [{ vendor: 'NOL 티켓', url: NOL }, { vendor: '멜론티켓', url: MELON }],
  },
  {
    id: 'c7', title: 'J-POP WINTER FES 2026', artistIds: ['a8', 'a9', 'a12'],
    startsAt: kst('2026-12-19T15:00'), ticketOpenAt: kst('2026-11-18T20:00'),
    venue: '킨텍스 제2전시장', venueQuery: '킨텍스 제2전시장', region: '경기',
    ticketLinks: [{ vendor: '멜론티켓', url: MELON }],
  },
  {
    id: 'c8', title: 'RADWIMPS Live in Seoul', artistIds: ['a7'],
    startsAt: kst('2026-12-26T18:00'), ticketOpenAt: kst('2026-11-25T20:00'),
    venue: '블루스퀘어 SOL트래블홀', venueQuery: '블루스퀘어', region: '서울',
    ticketLinks: [{ vendor: 'NOL 티켓', url: NOL }],
  },
  {
    id: 'c9', title: 'ZUTOMAYO Asia Tour Seoul', artistIds: ['a10'],
    startsAt: kst('2027-01-09T18:00'), ticketOpenAt: kst('2026-12-01T20:00'),
    venue: 'YES24 라이브홀', venueQuery: 'YES24 라이브홀', region: '서울',
    ticketLinks: [{ vendor: 'YES24 티켓', url: YES24 }],
  },
  {
    id: 'c10', title: 'ONE OK ROCK Asia Tour Seoul', artistIds: ['a11'],
    startsAt: kst('2027-01-16T18:00'), ticketOpenAt: kst('2026-12-08T20:00'),
    venue: 'KSPO DOME', venueQuery: 'KSPO DOME', region: '서울',
    ticketLinks: [{ vendor: '멜론티켓', url: MELON }],
  },
  {
    id: 'c11', title: '米津玄師 Asia Tour Seoul', artistIds: ['a3'],
    startsAt: kst('2027-01-23T18:00'), ticketOpenAt: kst('2026-12-10T20:00'),
    venue: '고척스카이돔', venueQuery: '고척스카이돔', region: '서울',
    ticketLinks: [{ vendor: 'NOL 티켓', url: NOL }],
  },
]

export const MOCK_USERS: MockUser[] = [
  { id: 'u1', nickname: '밤의소설', region: '서울', artistIds: ['a1', 'a6', 'a10'], regionPublic: true, willAccept: true },
  { id: 'u2', nickname: '마리골드', region: '경기', artistIds: ['a2', 'a3', 'a9'], regionPublic: true, willAccept: true },
  { id: 'u3', nickname: '하쿠기', region: '부산', artistIds: ['a4', 'a5'], regionPublic: false, willAccept: false },
  { id: 'u4', nickname: '라이락', region: '인천', artistIds: ['a8', 'a12', 'a1'], regionPublic: true, willAccept: true },
  { id: 'u5', nickname: '전전전세', region: '서울', artistIds: ['a7', 'a3'], regionPublic: true, willAccept: false },
  { id: 'u6', nickname: '우세모노', region: '대구', artistIds: ['a6', 'a1'], regionPublic: true, willAccept: true },
  { id: 'u7', nickname: '소란스러운밤', region: '서울', artistIds: ['a10', 'a9', 'a2'], regionPublic: false, willAccept: true },
  { id: 'u8', nickname: '나이트댄서', region: '경기', artistIds: ['a11', 'a4'], regionPublic: true, willAccept: true },
]

export const AUTO_REPLIES = [
  '안녕하세요! 반가워요 :)',
  '저도 그 곡 진짜 좋아해요',
  '이번 공연 예매하셨어요?',
  '굿즈 줄 엄청 길 것 같아요 ㅠㅠ',
]
