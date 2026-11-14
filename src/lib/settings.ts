// app_settings 테이블과 같은 값 (화면 안내용). 실제 제한은 DB 함수·트리거가 건다 (기획서 3.4)
export const APP_SETTINGS = {
  maxArtists: 5,
  maxGenres: 5,
  maxPostImages: 4,
  maxTags: 5,
} as const

// 닉네임 규칙: DB 제약 profiles_nickname_chars 와 같은 허용 문자 (한글·일본어·영문·숫자·공백 _ . -), 2~20자
const NICKNAME_RE = /^[가-힣ㄱ-ㅎㅏ-ㅣぁ-ゖァ-ヺー一-龯A-Za-z0-9 _.-]+$/
export const nicknameError = (raw: string) => {
  const n = raw.trim()
  if (n.length < 2 || n.length > 20) return '2~20자로 정해 주세요.'
  if (!NICKNAME_RE.test(n)) return '한글·일본어·영문·숫자와 공백 _ . - 만 쓸 수 있어요.'
}
