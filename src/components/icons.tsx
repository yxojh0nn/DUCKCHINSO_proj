// 자체 디자인 아이콘 (인앱 상세 기획: 기본 아이콘 대신 기능을 요약한 아이콘).
// 24×24, 1.7px 선. 아이콘 하나가 하나의 함수라서 모양만 따로 고칠 수 있다.
import type { SVGProps } from 'react'

type P = SVGProps<SVGSVGElement> & { size?: number; filled?: boolean }

const Svg = ({ size = 24, filled, children, ...rest }: P) => (
  <svg
    aria-hidden
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.7}
    strokeLinecap="round"
    strokeLinejoin="round"
    data-filled={filled || undefined}
    {...rest}
  >
    {children}
  </svg>
)

/* 하단 탭 */
// 공연·캘린더: 달력 한 장 오른쪽에 티켓 절취 홈
export const IconCalendar = (p: P) => (
  <Svg {...p}>
    <path d="M5 5.5h14a1 1 0 011 1V10a2 2 0 000 4v3.5a1 1 0 01-1 1H5a1 1 0 01-1-1v-11a1 1 0 011-1z" fill={p.filled ? 'currentColor' : 'none'} fillOpacity={0.12} />
    <path d="M8 3.5v4M14.5 3.5v4M4 9.5h11" />
    <circle cx="9" cy="14" r="1.2" fill="currentColor" stroke="none" />
  </Svg>
)
// 커뮤니티: 겹쳐 있는 두 개의 말 풍선
export const IconCommunity = (p: P) => (
  <Svg {...p}>
    <path d="M4 5.5h10a1.5 1.5 0 011.5 1.5v5a1.5 1.5 0 01-1.5 1.5H8.5L5.5 16v-2.5H4A1.5 1.5 0 012.5 12V7A1.5 1.5 0 014 5.5z" fill={p.filled ? 'currentColor' : 'none'} fillOpacity={0.12} />
    <path d="M15.5 9H20a1.5 1.5 0 011.5 1.5v5A1.5 1.5 0 0120 17h-1.5v2.5L15.5 17H11a1.5 1.5 0 01-1.5-1.5V13.5" />
  </Svg>
)
// 채팅: 둥근 말풍선과 두 개의 점(주고받는 대화)
export const IconChat = (p: P) => (
  <Svg {...p}>
    <path d="M12 4.5c4.7 0 8.5 3 8.5 6.8S16.7 18 12 18c-1 0-1.9-.1-2.8-.4L5 19.5l1.2-3.3C4.5 15 3.5 13.2 3.5 11.3 3.5 7.5 7.3 4.5 12 4.5z" fill={p.filled ? 'currentColor' : 'none'} fillOpacity={0.12} />
    <circle cx="9.3" cy="11.3" r="1.1" fill="currentColor" stroke="none" />
    <circle cx="14.7" cy="11.3" r="1.1" fill="currentColor" stroke="none" />
  </Svg>
)
// MY: 프로필 카드(머리 + 이름 줄)
export const IconMy = (p: P) => (
  <Svg {...p}>
    <rect x="3.5" y="4" width="17" height="16" rx="3" fill={p.filled ? 'currentColor' : 'none'} fillOpacity={0.12} />
    <circle cx="12" cy="10" r="2.6" />
    <path d="M7.5 17c.8-1.9 2.5-3 4.5-3s3.7 1.1 4.5 3" />
  </Svg>
)

// 멤버십: 확정 뱃지를 줄인 모양. 팔각 메달 안에 8분음표
export const IconMembership = (p: P) => (
  <Svg {...p}>
    <path d="M15.1 3.7l4.2 4.2v6.2l-4.2 4.2H8.9l-4.2-4.2V7.9l4.2-4.2z" transform="translate(0 1)" fill={p.filled ? 'currentColor' : 'none'} fillOpacity={0.12} />
    <ellipse cx="10.8" cy="15" rx="1.7" ry="1.3" transform="rotate(-20 10.8 15)" fill="currentColor" stroke="none" />
    <path d="M12.4 14.8V9c0 1.3 1.8 1.7 1.8 3.2" />
  </Svg>
)

/* 동작 */
export const IconSearch = (p: P) => (
  <Svg {...p}><circle cx="10.5" cy="10.5" r="5.5" /><path d="M15 15l4.5 4.5" /></Svg>
)
// 검색 범주: 높이가 다른 세 개의 조절 막대
export const IconFilter = (p: P) => (
  <Svg {...p}><path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="17" r="2" /></Svg>
)
// 친구 요청함: 사람 + 들어오는 화살표
export const IconRequests = (p: P) => (
  <Svg {...p}><circle cx="9.5" cy="8.5" r="3.2" /><path d="M3.5 19c.7-3.2 3-5 6-5s5.3 1.8 6 5" /><path d="M21 9h-4.5M18.5 7l-2 2 2 2" /></Svg>
)
export const IconAddFriend = (p: P) => (
  <Svg {...p}><circle cx="9.5" cy="8.5" r="3.2" /><path d="M3.5 19c.7-3.2 3-5 6-5s5.3 1.8 6 5" /><path d="M18.5 6.5v5M16 9h5" /></Svg>
)
export const IconMore = (p: P) => (
  <Svg {...p}><circle cx="5.5" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" /><circle cx="18.5" cy="12" r="1.3" fill="currentColor" stroke="none" /></Svg>
)
export const IconBack = (p: P) => <Svg {...p}><path d="M15 4.5L7.5 12l7.5 7.5" /></Svg>
export const IconMenu = (p: P) => <Svg {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Svg>
export const IconEye = (p: P) => <Svg {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></Svg>
export const IconEyeOff = (p: P) => <Svg {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /><path d="M4 4l16 16" /></Svg>
// 색 고르기: 물감 팔레트 (엄지 구멍 + 물감 점 셋)
export const IconPalette = (p: P) => (
  <Svg {...p}>
    <path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.3 0 1.9-.8 1.9-1.7 0-.5-.2-.9-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1 .8-1.7 1.8-1.7h2.1a3.7 3.7 0 0 0 3.7-3.7c0-4-3.8-7.3-8.5-7.3z" />
    <circle cx="7.6" cy="11.2" r="1" fill="currentColor" stroke="none" />
    <circle cx="10.4" cy="7.6" r="1" fill="currentColor" stroke="none" />
    <circle cx="14.8" cy="8" r="1" fill="currentColor" stroke="none" />
  </Svg>
)
export const IconLock =(p: P) => <Svg {...p}><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></Svg>
export const IconClose =(p: P) => <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>
export const IconChevron = (p: P) => <Svg {...p}><path d="M9.5 5.5L16 12l-6.5 6.5" /></Svg>
export const IconChevronDown = (p: P) => <Svg {...p}><path d="M5.5 9.5L12 16l6.5-6.5" /></Svg>
export const IconCheck = (p: P) => <Svg {...p}><path d="M5 12.5l4.5 4.5L19 7.5" /></Svg>
export const IconPlus = (p: P) => <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
// 사진: 액자 + 산 + 해
export const IconPhoto = (p: P) => (
  <Svg {...p}><rect x="3.5" y="5" width="17" height="14" rx="2.5" /><path d="M3.5 16l5-4.5 4 3.5 3-2.5 5 4" /><circle cx="15.5" cy="9.5" r="1.4" /></Svg>
)
// 이모지·GIF: 웃는 얼굴
export const IconSmile = (p: P) => (
  <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M8.5 14c.9 1.3 2 2 3.5 2s2.6-.7 3.5-2" /><path d="M9.2 9.6v.6M14.8 9.6v.6" strokeWidth={2.2} /></Svg>
)
// 저장: 아래 화살표와 받침
export const IconDownload = (p: P) => (
  <Svg {...p}><path d="M12 4.5v10.5M7.5 10.5 12 15l4.5-4.5M5 19.5h14" /></Svg>
)
// 보내기: 위로 향한 화살표 원 (채움)
export const IconSend = (p: P) => (
  <Svg {...p} strokeWidth={0}><circle cx="12" cy="12" r="10" fill="currentColor" /><path d="M12 16.5v-9M8 11l4-4 4 4" stroke="var(--paper)" strokeWidth={2} /></Svg>
)
// 관심 공연: 책갈피 (안은 비움)
export const IconTicket = (p: P) => (
  <Svg {...p}>
    <path d="M6.5 3.5h11a1 1 0 011 1v15.2a.5.5 0 01-.8.4L12 16.5l-5.7 3.6a.5.5 0 01-.8-.4V4.5a1 1 0 011-1z" fill={p.filled ? 'currentColor' : 'none'} />
  </Svg>
)
// 추천(글): 엄지 척. 추천하면 채워진다
export const IconUp = (p: P) => (
  <Svg {...p}>
    <path d="M7.5 10.5h-3a1 1 0 00-1 1v7.5a1 1 0 001 1h3z" fill={p.filled ? 'currentColor' : 'none'} />
    <path d="M7.5 10.5l3.4-6a1.7 1.7 0 013.1 1.3l-.8 3.7h5.2a2 2 0 012 2.4l-1.3 6.5a2 2 0 01-2 1.6H7.5z" fill={p.filled ? 'currentColor' : 'none'} />
  </Svg>
)
export const IconComment = (p: P) => (
  <Svg {...p}><path d="M5 5.5h14a1.5 1.5 0 011.5 1.5v8a1.5 1.5 0 01-1.5 1.5h-6L8 20v-3.5H5A1.5 1.5 0 013.5 15V7A1.5 1.5 0 015 5.5z" /></Svg>
)
// 채팅 없음: 말풍선에 사선
export const IconNoChat = (p: P) => (
  <Svg {...p}><path d="M12 4.5c4.7 0 8.5 3 8.5 6.8S16.7 18 12 18c-1 0-1.9-.1-2.8-.4L5 19.5l1.2-3.3C4.5 15 3.5 13.2 3.5 11.3 3.5 7.5 7.3 4.5 12 4.5z" /><path d="M4 3.5l16.5 17" /></Svg>
)
export const IconPin = (p: P) => (
  <Svg {...p}><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0113 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></Svg>
)
// 예매처 바로가기: 상자에서 나가는 화살표
export const IconExternal = (p: P) => (
  <Svg {...p}><path d="M13.5 4.5h6v6M19.5 4.5L11 13" /><path d="M17.5 14v4a1.5 1.5 0 01-1.5 1.5H6A1.5 1.5 0 014.5 18V8A1.5 1.5 0 016 6.5h4" /></Svg>
)
// 표시 방식 전환: 점·선 모드 / 이름 모드
export const IconViewMarks = (p: P) => (
  <Svg {...p}><circle cx="6" cy="8" r="1.6" fill="currentColor" stroke="none" /><circle cx="11" cy="8" r="1.6" fill="currentColor" stroke="none" /><path d="M5 14.5h11" strokeWidth={2.6} /><path d="M18 8h1.5" strokeWidth={2.6} /></Svg>
)
// 이름 모드: 달력 칸에 이름 띠가 붙은 모양 (곧은 선만)
export const IconViewNames = (p: P) => (
  <Svg {...p}><rect x="3.5" y="4.5" width="17" height="15.5" rx="2.5" /><path d="M3.5 9h17" /><rect x="6.5" y="12" width="11" height="2.6" rx=".6" fill="currentColor" stroke="none" /><rect x="6.5" y="16" width="7" height="1.6" rx=".5" fill="currentColor" stroke="none" opacity=".55" /></Svg>
)
// 설정: 톱니바퀴 (톱니 8개, 곧은 옆면)
export const IconGear = (p: P) => (
  <Svg {...p}><path d="M9.95 5.31L10.40 2.94A9.2 9.2 0 0 1 13.60 2.94L14.05 5.31A7.0 7.0 0 0 1 15.29 5.82L17.28 4.46A9.2 9.2 0 0 1 19.54 6.72L18.18 8.71A7.0 7.0 0 0 1 18.69 9.95L21.06 10.40A9.2 9.2 0 0 1 21.06 13.60L18.69 14.05A7.0 7.0 0 0 1 18.18 15.29L19.54 17.28A9.2 9.2 0 0 1 17.28 19.54L15.29 18.18A7.0 7.0 0 0 1 14.05 18.69L13.60 21.06A9.2 9.2 0 0 1 10.40 21.06L9.95 18.69A7.0 7.0 0 0 1 8.71 18.18L6.72 19.54A9.2 9.2 0 0 1 4.46 17.28L5.82 15.29A7.0 7.0 0 0 1 5.31 14.05L2.94 13.60A9.2 9.2 0 0 1 2.94 10.40L5.31 9.95A7.0 7.0 0 0 1 5.82 8.71L4.46 6.72A9.2 9.2 0 0 1 6.72 4.46L8.71 5.82A7.0 7.0 0 0 1 9.95 5.31Z" /><circle cx="12" cy="12" r="2.8" /></Svg>
)
export const IconFriends = (p: P) => (
  <Svg {...p}><circle cx="8.5" cy="9" r="2.8" /><circle cx="16" cy="9.5" r="2.3" /><path d="M3.5 18.5c.6-2.8 2.6-4.3 5-4.3s4.4 1.5 5 4.3M14.5 14.4c.5-.1 1-.2 1.5-.2 2.2 0 3.9 1.4 4.4 4" /></Svg>
)
export const IconInfo = (p: P) => (
  <Svg {...p}><rect x="4" y="4" width="16" height="16" rx="3.5" /><path d="M8 9h8M8 12.5h8M8 16h5" /></Svg>
)
// 문의: 큰 말풍선 속 굵은 물음표
export const IconInquiry = (p: P) => (
  <Svg {...p}>
    <path d="M12 2.8c5.1 0 9.2 3.5 9.2 7.9s-4.1 7.9-9.2 7.9c-1 0-2-.1-2.9-.4L4 20.8l1.3-4.2C3.7 15.2 2.8 13 2.8 10.7 2.8 6.3 6.9 2.8 12 2.8z" />
    <path d="M9.7 8.7a2.4 2.4 0 114 1.8c-.9.6-1.7 1.1-1.7 2.3" strokeWidth={2.1} />
    <circle cx="12" cy="15.4" r="1.15" fill="currentColor" stroke="none" />
  </Svg>
)
export const IconLogout = (p: P) => (
  <Svg {...p}><path d="M10 4.5H6A1.5 1.5 0 004.5 6v12A1.5 1.5 0 006 19.5h4" /><path d="M14.5 8l4 4-4 4M18.5 12H9.5" /></Svg>
)
export const IconWithdraw = (p: P) => (
  <Svg {...p}><circle cx="10" cy="8.5" r="3.2" /><path d="M4 19c.7-3.2 3-5 6-5 1.4 0 2.6.4 3.6 1" /><path d="M16.5 15.5l4 4M20.5 15.5l-4 4" /></Svg>
)
export const IconFlag = (p: P) => (
  <Svg {...p}><path d="M5.5 20.5v-16M5.5 4.5h11l-2.5 4 2.5 4h-11" /></Svg>
)
// 운영자: 방패 안 체크
export const IconAdmin = (p: P) => (
  <Svg {...p}><path d="M12 3.5l7 2.6v5.6c0 4.3-3 7.6-7 8.8-4-1.2-7-4.5-7-8.8V6.1z" /><path d="M8.8 12.2l2.2 2.2 4.2-4.4" /></Svg>
)
export const IconBlock = (p: P) => (
  <Svg {...p}><circle cx="12" cy="12" r="8" /><path d="M6.5 6.5l11 11" /></Svg>
)
export const IconWave = (p: P) => (
  <Svg {...p}><path d="M4 13c1.5-2 3-2 4.5 0s3 2 4.5 0 3-2 4.5 0 2 1.3 2.5 1" /><path d="M7 8.5c1-1.2 2-1.2 3 0M14 8.5c1-1.2 2-1.2 3 0" /></Svg>
)
