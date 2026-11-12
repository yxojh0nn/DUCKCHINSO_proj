import type { CapacitorConfig } from '@capacitor/cli'
import { KeyboardResize } from '@capacitor/keyboard'

// 앱 ID는 기획서 미결 사항(번들 ID 추후 지정). 스토어 등록 전에 확정해 바꾼다
const config: CapacitorConfig = {
  appId: 'com.duckchinso.app',
  appName: '덕친소',
  webDir: 'dist',
  android: { allowMixedContent: false },
  ios: { contentInset: 'never' },
  // 키보드가 올라오면 웹뷰를 키보드 위까지 줄여 채팅 입력 바가 키보드에 붙게
  plugins: { Keyboard: { resize: KeyboardResize.Native, resizeOnFullScreen: true } },
}

export default config
