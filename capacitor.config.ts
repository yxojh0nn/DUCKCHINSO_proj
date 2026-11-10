import type { CapacitorConfig } from '@capacitor/cli'

// 앱 ID는 기획서 미결 사항(번들 ID 추후 지정). 스토어 등록 전에 확정해 바꾼다
const config: CapacitorConfig = {
  appId: 'com.duckchinso.app',
  appName: '덕친소',
  webDir: 'dist',
  android: { allowMixedContent: false },
  ios: { contentInset: 'never' },
}

export default config
