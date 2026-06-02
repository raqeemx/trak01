import { Context, Next } from 'hono'
import { getCookie } from 'hono/cookie'
import { getAnonClient, getAdminClient, Env } from './supabase'

// قراءة توكن الوصول من الكوكي أو هيدر Authorization
function extractToken(c: Context): string | undefined {
  const cookieToken = getCookie(c, 'sb_access_token')
  if (cookieToken) return cookieToken
  const auth = c.req.header('Authorization')
  if (auth?.startsWith('Bearer ')) return auth.slice(7)
  return undefined
}

// middleware: يتحقق من المستخدم ويضع بياناته + عميل قاعدة بيانات بصلاحية admin
export async function authMiddleware(c: Context<Env>, next: Next) {
  const token = extractToken(c)
  c.set('db', getAdminClient(c.env))

  if (!token) {
    c.set('user', null)
    return next()
  }

  try {
    const anon = getAnonClient(c.env, token)
    const { data, error } = await anon.auth.getUser(token)
    if (error || !data.user) {
      c.set('user', null)
      return next()
    }
    // جلب الدور من profiles
    const admin = getAdminClient(c.env)
    const { data: profile } = await admin
      .from('profiles')
      .select('role, full_name')
      .eq('id', data.user.id)
      .single()

    c.set('user', {
      id: data.user.id,
      email: data.user.email || '',
      role: profile?.role || 'مدخل بيانات',
      full_name: profile?.full_name || '',
    })
  } catch {
    c.set('user', null)
  }
  return next()
}

// حماية مسارات API: يجب أن يكون مصادقاً
export async function requireAuth(c: Context<Env>, next: Next) {
  const user = c.get('user')
  if (!user) return c.json({ error: 'غير مصرح. يرجى تسجيل الدخول.' }, 401)
  return next()
}

// التحقق من صلاحية الكتابة حسب الدور
// مدير: كل شيء | مقيّم: قراءة + تعديل مشاريعه | مدخل بيانات: إضافة فقط
export function canDelete(role: string): boolean {
  return role === 'مدير'
}

export function canEdit(role: string): boolean {
  return role === 'مدير' || role === 'مقيّم'
}

export function canCreate(role: string): boolean {
  return role === 'مدير' || role === 'مقيّم' || role === 'مدخل بيانات'
}
