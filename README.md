# نظام إدارة عمليات الجرد والتقييم

لوحة متابعة تشغيلية لمكتب تقييم آلات ومعدات — تكرّر نظاماً قائماً على Notion، بواجهة عربية RTL بالكامل، عملة الريال السعودي (SAR)، وتواريخ ميلادية.

---

## نظرة عامة على المشروع
- **الاسم**: نظام إدارة عمليات الجرد والتقييم
- **الهدف**: متابعة العملاء والمشاريع والمراحل والمدفوعات والتقارير في لوحة واحدة احترافية.
- **التقنية**: Hono (على Node.js، محسّن لـ Cloudflare Pages) + Supabase (قاعدة بيانات + مصادقة) + TailwindCSS + FontAwesome.
- **المصادقة والأدوار**:
  - **مدير**: وصول كامل (إضافة/تعديل/حذف + إدارة المستخدمين).
  - **مقيّم**: يرى مشاريعه (التي هو مسؤول عنها أو معاون)، إضافة وتعديل.
  - **مدخل بيانات**: إضافة فقط (لا تعديل ولا حذف).

---

## ⚙️ طريقة التشغيل بالتفصيل

### 1) إعداد قاعدة البيانات في Supabase
1. أنشئ مشروعاً جديداً على [supabase.com](https://supabase.com).
2. افتح **SQL Editor** من القائمة الجانبية.
3. انسخ كامل محتوى ملف `supabase_schema.sql` والصقه ثم اضغط **Run**.
   - سيُنشئ الأنواع (ENUM)، الجداول الخمسة، الفهارس، الحسابات التلقائية (Triggers)، سياسات RLS، وبيانات تجريبية.
4. أنشئ المستخدمين من **Authentication > Users > Add user** (فعّل Auto Confirm).
5. حدّد دور كل مستخدم بتشغيل أمر SQL (مثال للمدير):
   ```sql
   update public.profiles set role = 'مدير' where email = 'admin@example.com';
   -- القيم المتاحة: 'مدير' | 'مقيّم' | 'مدخل بيانات'
   ```
6. من **Project Settings > API** انسخ القيم الثلاث:
   - `Project URL` → `SUPABASE_URL`
   - `anon public` → `SUPABASE_ANON_KEY`
   - `service_role` (سري!) → `SUPABASE_SERVICE_ROLE_KEY`

### 2) التشغيل محلياً (في الساندبوكس أو جهازك)
```bash
# 1. تثبيت الحزم
npm install

# 2. إعداد متغيرات البيئة
cp .dev.vars.example .dev.vars
# عدّل .dev.vars وضع قيم Supabase الثلاث

# 3. البناء
npm run build

# 4. التشغيل عبر PM2 (الساندبوكس)
pm2 start ecosystem.config.cjs
# أو محلياً على جهازك:
npm run dev:sandbox

# 5. الاختبار
curl http://localhost:3000
```
ثم افتح المتصفح على `http://localhost:3000` وسجّل الدخول.

### 3) النشر على Cloudflare Pages
```bash
# اضبط الأسرار في Cloudflare (مرة واحدة):
npx wrangler pages secret put SUPABASE_URL --project-name webapp
npx wrangler pages secret put SUPABASE_ANON_KEY --project-name webapp
npx wrangler pages secret put SUPABASE_SERVICE_ROLE_KEY --project-name webapp

# النشر:
npm run deploy:prod
```

---

## 📁 ملفات الموقع (التي ترفعها على GitHub)
```
webapp/
├── supabase_schema.sql      # ⭐ ملف SQL الكامل لـ Supabase
├── src/
│   ├── index.tsx            # نقطة الدخول (ربط API والواجهة)
│   ├── lib/
│   │   ├── supabase.ts      # عملاء Supabase (admin / anon)
│   │   ├── auth.ts          # المصادقة وفرض الأدوار (middleware)
│   │   └── constants.ts     # القوائم والألوان (تطابق SQL)
│   ├── routes/
│   │   └── api.ts           # كل مسارات الـ API (CRUD + Dashboard + Auth)
│   └── views/
│       └── app.ts           # هيكل HTML للصفحة (SPA shell)
├── public/static/
│   ├── app.js               # ⭐ كامل الواجهة الأمامية (SPA)
│   └── style.css            # تنسيقات RTL والتنبيهات
├── ecosystem.config.cjs     # إعداد PM2
├── wrangler.jsonc           # إعداد Cloudflare Pages
├── vite.config.ts           # إعداد البناء
├── tsconfig.json
├── package.json
├── .dev.vars.example        # نموذج متغيرات البيئة (لا ترفع .dev.vars الحقيقي)
└── .gitignore               # يتجاهل .dev.vars و node_modules و dist

# ملاحظة: لا ترفع .dev.vars (الأسرار) — موجود في .gitignore.
```

---

## 🔗 مسارات الـ API (Entry URIs)
| الطريقة | المسار | الوصف |
|---|---|---|
| POST | `/api/auth/login` | تسجيل الدخول (`{email, password}`) |
| POST | `/api/auth/register` | إنشاء مستخدم (مدير) |
| POST | `/api/auth/logout` | تسجيل الخروج |
| GET | `/api/auth/me` | المستخدم الحالي |
| GET | `/api/dashboard` | إحصاءات اللوحة الرئيسية |
| GET/POST/PUT/DELETE | `/api/clients[/:id]` | العملاء |
| POST | `/api/clients/:id/start-project` | بدء مشروع مرتبط بالعميل |
| GET/POST/PUT/DELETE | `/api/projects[/:id]` | المشاريع |
| GET | `/api/projects/:id/full` | تفاصيل مشروع + مراحله ومدفوعاته وتقاريره |
| GET/POST/PUT/DELETE | `/api/phases[/:id]` | مراحل المشاريع |
| GET/POST/PUT/DELETE | `/api/payments[/:id]` | المدفوعات |
| GET/POST/PUT/DELETE | `/api/reports[/:id]` | التقارير |
| GET | `/api/users` | المستخدمون (مدير) |
| PUT | `/api/users/:id/role` | تغيير دور مستخدم (مدير) |

---

## 🗃️ نموذج البيانات والعلاقات (5 جداول)
1. **clients (العملاء)** → مرتبط بـ projects و payments.
2. **projects (المشاريع)** → ينتمي لعميل، له مراحل ومدفوعات وتقارير.
3. **project_phases (مراحل المشاريع)** → ينتمي لمشروع.
4. **payments (المدفوعات)** → مرتبط بعميل ومشروع. `المتبقي = المطلوب − المدفوع` (حقل محسوب في قاعدة البيانات).
5. **reports (التقارير)** → ينتمي لمشروع.

**الحسابات التلقائية (في Supabase)**:
- **المبلغ المتبقي**: عمود `GENERATED ALWAYS` يُحسب تلقائياً.
- **معدل اكتمال المشروع**: Trigger يعيد الحساب تلقائياً = (عدد المراحل "تم التنفيذ" ÷ إجمالي المراحل) × 100، عند أي إضافة/تعديل/حذف لمرحلة.

---

## 🖥️ دليل الاستخدام
- **الرئيسية**: بطاقات (العملاء النشطون، المشاريع الفعّالة، المدفوعات المعلّقة، التقارير قيد العمل) + شريط أوامر سريعة + روابط الأقسام.
- **المشاريع**: 4 عروض — **جدول** (بحث/فلترة)، **لوحة Board** (مجمّعة حسب الحالة)، **تقويم** (أسبوعي/شهري حسب تاريخ التسليم)، **معرض Gallery** (للمشاريع النشطة). انقر أي مشروع لعرض تفاصيله ومراحله.
- **العملاء**: زر 🚀 "بدء مشروع" ينشئ مشروعاً مرتبطاً بالعميل مباشرة.
- **التنبيهات البصرية**: المشاريع/المدفوعات/المراحل المتأخرة عن تاريخها تظهر بخلفية حمراء وأيقونة تحذير.
- **مؤشرات الحالة الملوّنة**: كل حالة لها لون ثابت في كل العروض.

---

## النشر والحالة
- **المنصّة**: Cloudflare Pages
- **الحالة**: ✅ جاهز للتشغيل (يتطلب ربط Supabase)
- **التقنية**: Hono + Supabase + TailwindCSS + FontAwesome
- **آخر تحديث**: 2026-06-02

## الميزات غير المنفّذة / الخطوات المقترحة
- رفع المرفقات الفعلية (Supabase Storage) — حالياً الحقول جاهزة كروابط نصية.
- تقارير وإحصاءات رسومية (Charts) في الرئيسية.
- إشعارات بريدية للمدفوعات المتأخرة.
- تصدير البيانات إلى Excel/PDF.
