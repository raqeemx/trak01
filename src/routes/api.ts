import { Hono } from 'hono'
import { setCookie, deleteCookie } from 'hono/cookie'
import { Env, getAnonClient } from '../lib/supabase'
import { requireAuth, canDelete, canEdit, canCreate } from '../lib/auth'
import { ACTIVE_PROJECT_STATUS } from '../lib/constants'

const api = new Hono<Env>()

/* ============================ المصادقة ============================ */

// تسجيل الدخول
api.post('/auth/login', async (c) => {
  const { email, password } = await c.req.json()
  if (!email || !password) return c.json({ error: 'البريد وكلمة المرور مطلوبان' }, 400)

  const anon = getAnonClient(c.env)
  const { data, error } = await anon.auth.signInWithPassword({ email, password })
  if (error || !data.session) return c.json({ error: 'بيانات الدخول غير صحيحة' }, 401)

  setCookie(c, 'sb_access_token', data.session.access_token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: data.session.expires_in,
    path: '/',
  })
  setCookie(c, 'sb_refresh_token', data.session.refresh_token, {
    httpOnly: true,
    secure: true,
    sameSite: 'Lax',
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
  })

  // جلب الدور
  const db = c.get('db')
  const { data: profile } = await db.from('profiles').select('role, full_name').eq('id', data.user.id).single()
  return c.json({ success: true, user: { email: data.user.email, role: profile?.role, full_name: profile?.full_name } })
})

// تسجيل مستخدم جديد (للمدير فقط من الواجهة، أو افتراضياً مدخل بيانات)
api.post('/auth/register', async (c) => {
  const { email, password, full_name, role } = await c.req.json()
  if (!email || !password) return c.json({ error: 'البريد وكلمة المرور مطلوبان' }, 400)

  const db = c.get('db')
  const { data, error } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: full_name || '', role: role || 'مدخل بيانات' },
  })
  if (error) return c.json({ error: error.message }, 400)
  return c.json({ success: true, user: { id: data.user.id, email: data.user.email } })
})

// تسجيل الخروج
api.post('/auth/logout', (c) => {
  deleteCookie(c, 'sb_access_token', { path: '/' })
  deleteCookie(c, 'sb_refresh_token', { path: '/' })
  return c.json({ success: true })
})

// المستخدم الحالي
api.get('/auth/me', (c) => {
  const user = c.get('user')
  if (!user) return c.json({ user: null }, 401)
  return c.json({ user })
})

/* ============================ Dashboard ============================ */

api.get('/dashboard', requireAuth, async (c) => {
  const db = c.get('db')

  const [clients, projects, payments, reports] = await Promise.all([
    db.from('clients').select('id, status'),
    db.from('projects').select('id, status, delivery_date, completion_rate'),
    db.from('payments').select('id, status, amount_remaining, paid_date, sent_date'),
    db.from('reports').select('id, status'),
  ])

  const clientsData = clients.data || []
  const projectsData = projects.data || []
  const paymentsData = payments.data || []
  const reportsData = reports.data || []

  const today = new Date().toISOString().slice(0, 10)

  // العملاء النشطون = ليسوا "غير نشط" أو "مرفوض"
  const activeClients = clientsData.filter(
    (x: any) => x.status !== 'غير نشط/توقف التواصل' && x.status !== 'مرفوض/لا نتعامل معه'
  ).length

  // المشاريع الفعّالة (قيد التنفيذ)
  const activeProjects = projectsData.filter((x: any) => (ACTIVE_PROJECT_STATUS as readonly string[]).includes(x.status))
  // المشاريع المتأخرة عن التسليم
  const overdueProjects = activeProjects.filter((x: any) => x.delivery_date && x.delivery_date < today).length

  // المدفوعات المعلّقة (ليست مدفوعة بالكامل/مغلقة)
  const pendingPayments = paymentsData.filter(
    (x: any) => x.status !== 'تم السداد بالكامل' && x.status !== 'مدفوع ومغلق'
  )
  const pendingAmount = pendingPayments.reduce((s: number, x: any) => s + Number(x.amount_remaining || 0), 0)
  const overduePayments = paymentsData.filter((x: any) => x.status === 'متأخر عن السداد').length

  // التقارير قيد العمل (مسودة أو تحت المراجعة)
  const workingReports = reportsData.filter((x: any) => x.status !== 'نهائي').length

  return c.json({
    activeClients,
    totalClients: clientsData.length,
    activeProjects: activeProjects.length,
    overdueProjects,
    pendingPayments: pendingPayments.length,
    pendingAmount,
    overduePayments,
    workingReports,
    totalReports: reportsData.length,
  })
})

/* ============================ مساعد عام لإنشاء CRUD ============================ */

function buildCrud(table: string, opts: { select?: string } = {}) {
  const router = new Hono<Env>()
  const select = opts.select || '*'

  // قائمة
  router.get('/', requireAuth, async (c) => {
    const db = c.get('db')
    const { data, error } = await db.from(table).select(select).order('created_at', { ascending: false })
    if (error) return c.json({ error: error.message }, 500)
    return c.json({ data })
  })

  // عنصر واحد
  router.get('/:id', requireAuth, async (c) => {
    const db = c.get('db')
    const { data, error } = await db.from(table).select(select).eq('id', c.req.param('id')).single()
    if (error) return c.json({ error: error.message }, 404)
    return c.json({ data })
  })

  // إنشاء
  router.post('/', requireAuth, async (c) => {
    const user = c.get('user')!
    if (!canCreate(user.role)) return c.json({ error: 'لا تملك صلاحية الإضافة' }, 403)
    const db = c.get('db')
    const body = await c.req.json()
    body.created_by = user.id
    const { data, error } = await db.from(table).insert(body).select().single()
    if (error) return c.json({ error: error.message }, 400)
    return c.json({ data })
  })

  // تعديل
  router.put('/:id', requireAuth, async (c) => {
    const user = c.get('user')!
    if (!canEdit(user.role)) return c.json({ error: 'لا تملك صلاحية التعديل (مدخل البيانات يضيف فقط)' }, 403)
    const db = c.get('db')
    const body = await c.req.json()
    delete body.id
    delete body.created_at
    delete body.amount_remaining // حقل محسوب
    delete body.completion_rate // حقل محسوب
    const { data, error } = await db.from(table).update(body).eq('id', c.req.param('id')).select().single()
    if (error) return c.json({ error: error.message }, 400)
    return c.json({ data })
  })

  // حذف
  router.delete('/:id', requireAuth, async (c) => {
    const user = c.get('user')!
    if (!canDelete(user.role)) return c.json({ error: 'الحذف للمدير فقط' }, 403)
    const db = c.get('db')
    const { error } = await db.from(table).delete().eq('id', c.req.param('id'))
    if (error) return c.json({ error: error.message }, 400)
    return c.json({ success: true })
  })

  return router
}

/* ============================ العملاء ============================ */
api.route('/clients', buildCrud('clients'))

// زر "بدء مشروع" — ينشئ مشروعاً مرتبطاً بالعميل
api.post('/clients/:id/start-project', requireAuth, async (c) => {
  const user = c.get('user')!
  if (!canCreate(user.role)) return c.json({ error: 'لا تملك صلاحية الإضافة' }, 403)
  const db = c.get('db')
  const clientId = c.req.param('id')
  const { data: client } = await db.from('clients').select('name').eq('id', clientId).single()
  const body = await c.req.json().catch(() => ({}))
  const { data, error } = await db
    .from('projects')
    .insert({
      name: body.name || `مشروع جديد - ${client?.name || ''}`,
      client_id: clientId,
      status: 'مرحلة تحديد النطاق',
      created_by: user.id,
    })
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 400)
  return c.json({ data })
})

/* ============================ المشاريع ============================ */
const projects = buildCrud('projects', { select: '*, clients(name)' })

// قائمة المشاريع للمقيّم: مشاريعه فقط (حيث هو المسؤول)
api.get('/projects', requireAuth, async (c) => {
  const db = c.get('db')
  const user = c.get('user')!
  let query = db.from('projects').select('*, clients(name)').order('created_at', { ascending: false })
  // المقيّم يرى مشاريعه (التي هو مسؤول عنها أو معاون)
  if (user.role === 'مقيّم') {
    query = query.or(`manager.eq.${user.full_name},assistants.cs.{${user.full_name}}`)
  }
  const { data, error } = await query
  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

api.route('/projects', projects)

// مراحل مشروع محدد + تقرير ومدفوعات
api.get('/projects/:id/full', requireAuth, async (c) => {
  const db = c.get('db')
  const id = c.req.param('id')
  const [project, phases, payments, reports] = await Promise.all([
    db.from('projects').select('*, clients(name, email, phone)').eq('id', id).single(),
    db.from('project_phases').select('*').eq('project_id', id).order('due_date'),
    db.from('payments').select('*').eq('project_id', id),
    db.from('reports').select('*').eq('project_id', id),
  ])
  return c.json({
    project: project.data,
    phases: phases.data || [],
    payments: payments.data || [],
    reports: reports.data || [],
  })
})

/* ============================ مراحل المشاريع ============================ */
api.route('/phases', buildCrud('project_phases'))

/* ============================ المدفوعات ============================ */
api.route('/payments', buildCrud('payments', { select: '*, clients(name), projects(name)' }))

/* ============================ التقارير ============================ */
api.route('/reports', buildCrud('reports', { select: '*, projects(name)' }))

/* ============================ المستخدمون (للمدير) ============================ */
api.get('/users', requireAuth, async (c) => {
  const user = c.get('user')!
  if (user.role !== 'مدير') return c.json({ error: 'للمدير فقط' }, 403)
  const db = c.get('db')
  const { data } = await db.from('profiles').select('*').order('created_at', { ascending: false })
  return c.json({ data })
})

api.put('/users/:id/role', requireAuth, async (c) => {
  const user = c.get('user')!
  if (user.role !== 'مدير') return c.json({ error: 'للمدير فقط' }, 403)
  const db = c.get('db')
  const { role } = await c.req.json()
  const { data, error } = await db.from('profiles').update({ role }).eq('id', c.req.param('id')).select().single()
  if (error) return c.json({ error: error.message }, 400)
  return c.json({ data })
})

export default api
