// 외부 앱 열기 규칙 (기획서 3.4): 예매는 외부 브라우저, 길찾기는 지도 앱.
// 웹에서는 새 탭으로 열고, Capacitor 패키징 후에는 App Launcher·Browser 플러그인으로 교체한다.
const openExternal = (url: string) => window.open(url, '_blank', 'noopener,noreferrer')

export const openTicket = (url: string) => openExternal(url)

export const openKakaoMap = (query: string) =>
  openExternal(`https://map.kakao.com/link/search/${encodeURIComponent(query)}`)

export const openGoogleMap = (query: string) =>
  openExternal(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`)
