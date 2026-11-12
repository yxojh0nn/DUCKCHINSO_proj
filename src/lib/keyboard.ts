import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'

// 키보드가 올라오면 채팅 입력 바가 키보드 바로 위에 붙게.
// 앱: iOS 는 웹뷰 크기를 줄이고(capacitor.config Keyboard.resize) 키보드 위 이전/다음/완료 줄을 숨긴다. 안드로이드는 adjustResize.
// 모바일 웹: 앱(#root) 높이를 보이는 높이(visualViewport.height)로 줄이고, 페이지는 늘 맨 위에 둔다.
// iOS 사파리는 키보드가 올라올 때 페이지를 밀어 올리는데, iOS 26 은 밀린 양(offsetTop·pageTop)을 0 으로 알려 주거나
// 이벤트가 늦어서 따라가는 방식은 입력 바가 화면 맨 위로 튀었다(WebKit 297779·300523). 그래서 따라가지 않고 밀리면 바로 되돌린다.
// 키보드가 떠 있는 동안 페이지를 끌어도 되돌리므로 입력 바는 키보드 위에 고정된다
export function setupKeyboard() {
  if (Capacitor.getPlatform() === 'ios') Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => {})
  const vv = window.visualViewport
  const root = document.getElementById('root')
  if (!vv || !root || !matchMedia('(pointer: coarse)').matches) return
  const debug = new URLSearchParams(location.search).has('kbdebug') // 실기기에서 값 확인용: 주소 뒤에 ?kbdebug
  const open = () => innerHeight - vv.height > 120 // 키보드가 떠 있다
  const pin = () => {
    if (!open() || vv.scale > 1.01) return
    // 같은 위치로의 scrollTo 는 무시될 수 있어 1px 밀었다가 되돌린다
    window.scrollTo(0, 1)
    window.scrollTo(0, 0)
  }
  const fit = () => {
    if (vv.scale > 1.01) return // 두 손가락으로 화면을 확대한 동안은 그대로
    root.style.height = `${vv.height}px`
    pin()
    if (debug) root.dataset.kb = `vv ${Math.round(vv.height)} off ${Math.round(vv.offsetTop)} pageTop ${Math.round(vv.pageTop)} scrollY ${Math.round(scrollY)} inner ${innerHeight}`
  }
  vv.addEventListener('resize', fit)
  vv.addEventListener('scroll', fit)
  window.addEventListener('scroll', fit)
  // iOS 가 밀어 올리는 애니메이션은 resize 이벤트보다 늦게 끝날 때가 있다
  document.addEventListener('focusin', () => [100, 300, 600].forEach((ms) => setTimeout(fit, ms)))
  fit()
}
