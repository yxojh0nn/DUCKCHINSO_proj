// app_settings 테이블과 같은 값 (화면 안내용). 실제 제한은 DB 함수·트리거가 건다 (기획서 3.4)
export const APP_SETTINGS = {
  maxArtists: 5,
  maxGenres: 5,
  maxPostImages: 4,
  maxTags: 5,
} as const
