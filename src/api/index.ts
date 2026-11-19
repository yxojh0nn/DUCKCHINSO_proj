import { supabase } from '@/lib/supabase'
import { createSupabaseApi } from './supabaseApi'
import { createDemoApi } from './demoApi'

// VITE_SUPABASE_URL·ANON_KEY 가 있으면 실제 백엔드, 없으면 브라우저 안에서 도는 데모 백엔드
export const api = supabase ? createSupabaseApi(supabase) : createDemoApi()
export const isDemo = !supabase
export * from './types'
