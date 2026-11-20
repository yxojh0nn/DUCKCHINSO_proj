import type { ContributionKind, ContributionStatus, InfoCategory } from '@/api/types'

// 유저 정보 제보 (마이그레이션 56). 문안은 법률 검토 전 초안이다
export const KIND_LABEL: Record<ContributionKind, string> = { ticket_open: '예매 오픈일', genre: '장르', info: '공연 정보' }
export const CATEGORY_LABEL: Record<InfoCategory, string> = { artist: '아티스트 정보', rules: '공연 수칙', tips: '꿀팁' }
export const CATEGORIES = Object.keys(CATEGORY_LABEL) as InfoCategory[]
export const STATUS_LABEL: Record<ContributionStatus, string> = { pending: '검수 중', approved: '반영됨', rejected: '반려됨', duplicate: '다른 제보가 먼저 반영됨' }

// DB admin_reject_contribution 과 같은 단계 (최근 1년 "거부 및 제재" 횟수)
export const PENALTY_STEPS = ['7일', '14일', '30일', '영구']
export const penaltyFor = (count: number) => PENALTY_STEPS[Math.min(count, PENALTY_STEPS.length - 1)]

// 제보 기능 첫 이용 때 받는 동의 (consents.item = 'contribution')
export const CONTRIB_CONSENT = [
  '보내 주신 정보는 운영자가 확인한 뒤 공연 상세와 공연 정보 페이지에 공개돼요.',
  '덕친소는 공개된 정보를 서비스 안에서 고치거나 내릴 수 있어요.',
  '반영되면 포인트를 드려요. 포인트는 현금이나 결제 수단으로 바꿀 수 없고, 탈퇴하면 사라져요.',
  '사실과 다른 정보를 일부러 반복해 보내면 제보 기능이 7일·14일·30일·영구 순으로 정지될 수 있어요.',
  '제보 내용과 처리 기록은 처리 후 1년 동안 보관해요.',
]

export const NICKNAME_CONSENT = '반영된 정보 옆에 내 닉네임 표시 (선택)'
export const MAX_GENRES = 3 // DB check_genre_ids 와 같은 값

// 운영자 검수 화면: 개인정보로 보이는 글 (전화번호·이메일·계좌 형태) 표시용. 막지는 않는다
export const looksPersonal = (t: string) =>
  /01[016789][-\s.]?\d{3,4}[-\s.]?\d{4}|[\w.+-]+@[\w-]+\.[\w.]+|\d{2,6}-\d{2,6}-\d{2,8}/.test(t)
