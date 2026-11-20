import { createClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'
import { SecureStorage } from '@aparajita/capacitor-secure-storage'
import { issueLoginVerifier } from './loginNonce'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// 앱 번들에는 anon 키만 들어간다. 권한은 DB의 RLS가 막는다 (기획서 3.4)
// 앱: 세션(AT·RT)을 WebView localStorage 대신 iOS Keychain · Android Keystore 에 둔다 (보안 감사 #1 ④ — 기기 파일·백업에서 꺼내지 못하게)
export const supabase = url && key
  ? createClient(url, key, {
      auth: {
        flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: !Capacitor.isNativePlatform(),
        ...(Capacitor.isNativePlatform() ? { storage: SecureStorage } : {}),
      },
    })
  : null

export const APP_SCHEME = 'com.duckchinso.app'

// 소셜 로그인 후 돌아올 주소 (social-login 의 returnUrl 과 같은 값). 안드로이드는 App Links, iOS 는 커스텀 스킴, 웹은 현재 도메인
// 구글·애플(Supabase 기본 제공자)도 이 주소로 돌아오므로 Supabase Auth 허용 redirect 목록에 모두 있어야 한다
export const APP_LINK_CALLBACK = 'https://duckchinso.com/auth/app-callback'
const platformTarget = () => Capacitor.getPlatform() === 'android' ? 'android' : Capacitor.getPlatform() === 'ios' ? 'ios' : null
export const authRedirect = () => {
  const p = platformTarget()
  return p === 'android' ? APP_LINK_CALLBACK : p === 'ios' ? `${APP_SCHEME}://auth/callback` : `${window.location.origin}/auth/callback`
}

// 네이버·카카오 로그인 시작 주소 (서버 함수 social-login). 끝나면 authRedirect() 로 #sl_code 를 들고 돌아온다
// 누를 때마다 부른다: verifier 는 이 기기에만 저장되고, 서버에는 그 해시(cc)만 간다
export const socialLoginUrl = async (provider: 'naver' | 'kakao') =>
  `${url}/functions/v1/social-login?provider=${provider}&to=${platformTarget() ?? encodeURIComponent(window.location.origin)}&cc=${await issueLoginVerifier()}`
