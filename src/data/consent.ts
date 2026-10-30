// 동의 항목 (기획서 9.2). 문안은 법률 검토 전 초안이다.
export type ConsentItem = { key: string; label: string; required: boolean; body: string }

export const CONSENT_VERSION = '2026-10-30'

export const CONSENT_ITEMS: ConsentItem[] = [
  { key: 'age14', label: '만 14세 이상입니다', required: true,
    body: '만 14세 미만은 이용할 수 없습니다. 만 14세 미만으로 확인되면 계정이 정지될 수 있습니다.' },
  { key: 'terms', label: '서비스 이용약관 동의', required: true,
    body: '공연 일정 조회, 취향 매칭, 1:1 대화 기능의 이용 조건과 회사·이용자의 권리와 의무를 정합니다. (초안)' },
  { key: 'privacy', label: '개인정보 수집·이용 동의', required: true,
    body: '수집 항목: 임시 계정 ID, 관심 아티스트, 지역(시·도), 대화 내용, 기기 정보. 목적: 공연 추천, 매칭, 신고 처리. 보유 기간: 탈퇴 시까지(법령상 보관 의무가 있는 경우 해당 기간).' },
  { key: 'policy', label: '운영정책 및 계정 제재 고지 확인', required: true,
    body: '개인정보 보호법, 정보통신망법, 공연법(암표·매크로 거래) 등 관련 법률과 운영정책을 위반하면 경고, 기능 제한, 계정 정지 또는 영구 이용 제한이 될 수 있습니다. 티켓 사기·암표 거래·불법 촬영물·성희롱 등은 즉시 정지되며 수사기관 요청 시 법령에 따라 협조합니다.' },
  { key: 'push', label: '서비스 알림 수신 (선택)', required: false,
    body: '대화 요청, 수락, 새 메시지, 관심 공연 예매 오픈 알림을 받습니다.' },
  { key: 'marketing', label: '광고성 정보 수신 (선택)', required: false,
    body: '이벤트·혜택 안내를 받습니다. 언제든 설정에서 철회할 수 있습니다.' },
  { key: 'nightMarketing', label: '야간(21시~08시) 광고성 정보 수신 (선택)', required: false,
    body: '야간 시간대에도 광고성 알림을 받습니다.' },
]
