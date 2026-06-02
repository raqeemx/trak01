import { createClient, SupabaseClient } from '@supabase/supabase-js'

export type Env = {
  Bindings: {
    SUPABASE_URL: string
    SUPABASE_ANON_KEY: string
    SUPABASE_SERVICE_ROLE_KEY: string
  }
  Variables: {
    user: { id: string; email: string; role: string; full_name: string } | null
    db: SupabaseClient
  }
}

// عميل بصلاحية service_role (يتجاوز RLS) — يُستخدم في الـ backend بعد التحقق من الدور
export function getAdminClient(env: Env['Bindings']): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// عميل anon — للتحقق من توكن المستخدم
export function getAnonClient(env: Env['Bindings'], accessToken?: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : {},
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
