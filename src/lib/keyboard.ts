import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'

// 키보드가 올라오면 채팅 입력 바가 키보드 바로 위에 붙게.
// 앱: iOS 는 웹뷰 크기를 줄이고(capacitor.config Keyboard.resize) 키보드 위 이전/다음/완료 줄을 숨긴다. 안드로이드는 adjustResize.
// 모바일 웹: 앱(#root)을 지금 보이는 영역(visualViewport)에 딱 맞춰 고정한다.
// iOS 사파리는 키보드가 올라오면 화면을 줄이지 않고 페이지를 위로 밀어 올린다. 높이만 줄이면 밀린 만큼 아래 빈 곳이 보이고
// 입력 바가 대화를 가렸다. 그래서 밀린 위치(offsetTop)까지 따라가고, 키보드가 떠 있는 동안 페이지를 끌어도 다시 맞춘다
export function setupKeyboard() {
  if (Capacitor.getPlatform() === 'ios') Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => {})
  const vv = window.visualViewport
  const root = document.getElementById('root')
  if (!vv || !root || !matchMedia('(pointer: coarse)').matches) return
  Object.assign(root.style, { position: 'fixed', left: '0', right: '0' })
  const fit = () => {
    if (vv.scale > 1.01) return // 두 손가락으로 화면을 확대한 동안은 그대로
    root.style.top = `${vv.offsetTop}px`
    root.style.height = `${vv.height}px`
  }
  vv.addEventListener('resize', fit)
  vv.addEventListener('scroll', fit)
  fit()
}
