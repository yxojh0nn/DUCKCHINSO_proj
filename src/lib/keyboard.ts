import { Capacitor } from '@capacitor/core'
import { Keyboard } from '@capacitor/keyboard'

// 키보드가 올라오면 채팅 입력 바가 키보드 바로 위에 붙게.
// 앱: iOS 는 웹뷰 크기를 줄이고(capacitor.config Keyboard.resize) 키보드 위 이전/다음/완료 줄을 숨긴다. 안드로이드는 adjustResize.
// 모바일 웹: 앱(#root)을 지금 보이는 영역(visualViewport)에 딱 맞춘다. iOS 사파리는 키보드가 올라오면 화면을 줄이지 않고 페이지를 밀어 올린다.
// position: fixed 로 맞추면 iOS 26 버그(키보드가 뜬 동안 fixed 기준점이 어긋남, WebKit 297779·300523)로 입력 바가 맨 위로 튀었다.
// 그래서 문서 좌표(absolute + pageTop)로 맞춘다. 페이지를 끌어도 scroll 이벤트로 다시 맞춘다
export function setupKeyboard() {
  if (Capacitor.getPlatform() === 'ios') Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => {})
  const vv = window.visualViewport
  const root = document.getElementById('root')
  if (!vv || !root || !matchMedia('(pointer: coarse)').matches) return
  Object.assign(root.style, { position: 'absolute', left: '0', right: '0' })
  const debug = new URLSearchParams(location.search).has('kbdebug') // 실기기에서 값 확인용: 주소 뒤에 ?kbdebug
  const fit = () => {
    if (vv.scale > 1.01) return // 두 손가락으로 화면을 확대한 동안은 그대로
    root.style.top = `${vv.pageTop}px`
    root.style.height = `${vv.height}px`
    if (debug) root.dataset.kb = `vv ${Math.round(vv.height)} off ${Math.round(vv.offsetTop)} pageTop ${Math.round(vv.pageTop)} scrollY ${Math.round(scrollY)} inner ${innerHeight}`
  }
  vv.addEventListener('resize', fit)
  vv.addEventListener('scroll', fit)
  window.addEventListener('scroll', fit)
  fit()
}
