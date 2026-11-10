import { Capacitor } from '@capacitor/core'
import { AppLauncher } from '@capacitor/app-launcher'

// 외부 앱 열기 규칙 (기획서 3.4): 예매는 외부 브라우저, 길찾기는 지도 앱. 웹은 새 탭
const openExternal = (url: string) => {
  if (Capacitor.isNativePlatform()) AppLauncher.openUrl({ url })
  else window.open(url, '_blank', 'noopener,noreferrer')
}

export const openTicket = (url: string) => openExternal(url)

export const openKakaoMap = (query: string) =>
  openExternal(`https://map.kakao.com/link/search/${encodeURIComponent(query)}`)

export const openGoogleMap = (query: string) =>
  openExternal(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`)
