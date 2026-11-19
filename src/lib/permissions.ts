import { Capacitor } from '@capacitor/core'
import { AppLauncher } from '@capacitor/app-launcher'

// 앱 접근 권한 (정보통신망법 22조의2: 항목·이유·필수/선택을 알리고, 선택 권한은 거부해도 앱을 쓸 수 있게)
// 덕친소는 필수 권한이 없다. 모두 그 기능을 처음 쓸 때 기기가 묻는다
export type PermKey = 'camera' | 'location' | 'photos'
export const PERMISSIONS: { key: PermKey; label: string; why: string; ios?: boolean }[] = [
  { key: 'camera', label: '카메라', why: '프로필·게시글·채팅·덕질 캘린더에 올릴 사진을 바로 찍을 때' },
  { key: 'location', label: '위치 (대략적인 위치)', why: '프로필 활동 지역(시·도)을 자동으로 고를 때. 위치는 기기 안에서 지역을 고르는 데만 쓰고 서버로 보내지 않아요' },
  { key: 'photos', label: '사진 보관함 (저장)', why: '채팅에서 받은 사진·영상과 리캡 카드를 사진 앱에 저장할 때', ios: true },
]

export type PermState = 'granted' | 'denied' | 'prompt' | 'unknown'

// 지금 상태. 브라우저·기기가 알려 주지 않으면 unknown
export async function permState(key: PermKey): Promise<PermState> {
  if (key === 'photos') return 'unknown' // 저장할 때만 묻고, 상태를 웹에서 읽을 방법이 없다
  try {
    const s = await navigator.permissions.query({ name: (key === 'location' ? 'geolocation' : 'camera') as PermissionName })
    return s.state
  } catch { return 'unknown' }
}

// 기기에 권한을 묻는다. 한 번 거부하면 기기가 다시 묻지 않으므로 그때는 openAppSettings 로
export async function askPermission(key: PermKey): Promise<boolean> {
  if (key === 'location') return getPosition().then(() => true, () => false)
  if (key === 'camera') {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true })
      s.getTracks().forEach((t) => t.stop()) // 권한만 받고 카메라는 바로 끈다
      return true
    } catch { return false }
  }
  return false
}

export const getPosition = () => new Promise<GeolocationPosition>((ok, fail) =>
  navigator.geolocation.getCurrentPosition(ok, fail, { enableHighAccuracy: false, maximumAge: 600_000, timeout: 15_000 }))

// 기기 설정의 이 앱 화면 열기. iOS 만 된다 (Android 는 안내 문구로)
export async function openAppSettings() {
  if (Capacitor.getPlatform() !== 'ios') return false
  await AppLauncher.openUrl({ url: 'app-settings:' })
  return true
}

export const SETTINGS_HINT = Capacitor.getPlatform() === 'android'
  ? '휴대폰 설정 › 애플리케이션 › 덕친소 › 권한에서 켤 수 있어요.'
  : Capacitor.isNativePlatform() ? '휴대폰 설정 › 덕친소에서 켤 수 있어요.' : '브라우저 주소창 왼쪽의 사이트 설정에서 켤 수 있어요.'
