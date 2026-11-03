import { createClient } from '@supabase/supabase-js'
import { Capacitor } from '@capacitor/core'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// 앱 번들에는 anon 키만 들어간다. 권한은 DB의 RLS가 막는다 (기획서 3.4)
export const supabase = url && key
  ? createClient(url, key, {
      auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: !Capacitor.isNativePlatform() },
    })
  : null

export const APP_SCHEME = 'com.duckchinso.app'

// 소셜 로그인·메일 인증 후 돌아올 주소. 앱은 커스텀 스킴, 웹은 현재 도메인
export const authRedirect = () =>
  Capacitor.isNativePlatform() ? `${APP_SCHEME}://auth/callback` : `${window.location.origin}/auth/callback`
