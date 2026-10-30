// app_settings 테이블 대체. 운영 중 값을 바꿀 수 있게 코드 곳곳에 숫자를 직접 쓰지 않는다 (기획서 3.4).
export const APP_SETTINGS = {
  maxArtists: 5, // 3~5 범위에서 운영 조정
  dailyRequestLimit: 2, // 1~2, 한국 시간 자정 초기화
  requestExpireDays: 3,
} as const
