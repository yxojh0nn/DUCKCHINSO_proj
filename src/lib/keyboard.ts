import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'

// 키보드가 올라오면 채팅 입력 바가 키보드 바로 위에 붙게.
// 앱: iOS 는 웹뷰 크기를 줄이고(capacitor.config Keyboard.resize) 키보드 위 이전/다음/완료 줄을 숨긴다. 안드로이드는 adjustResize.
// 모바일 웹: 보이는 높이(visualViewport)만큼만 앱을 그린다. iOS 사파리는 화면을 줄이지 않고 키보드로 덮은 뒤 페이지를 밀어 올리기 때문
export function setupKeyboard() {
  if (Capacitor.getPlatform() === 'ios') Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => {})
  const vv = window.visualViewport
  if (!vv || !matchMedia('(pointer: coarse)').matches) return
  const fit = () => {
    // 두 손가락 확대 중엔 height 가 줄어드니 배율을 곱해 원래 높이로
    document.documentElement.style.height = `${Math.round(vv.height * vv.scale)}px`
    if (vv.scale === 1) window.scrollTo(0, 0)
  }
  vv.addEventListener('resize', fit)
  fit()
}
