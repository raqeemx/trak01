import { Hono } from 'hono'
import { Env } from './lib/supabase'
import { authMiddleware } from './lib/auth'
import api from './routes/api'
import { renderApp } from './views/app'

const app = new Hono<Env>()

// middleware المصادقة لكل الطلبات
app.use('*', authMiddleware)

// مسارات API
app.route('/api', api)

// كل المسارات الأخرى تقدّم تطبيق SPA
app.get('*', (c) => {
  return c.html(renderApp())
})

export default app
