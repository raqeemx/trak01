-- =====================================================================
-- نظام إدارة عمليات الجرد والتقييم - مكتب تقييم آلات ومعدات
-- ملف SQL كامل جاهز للتشغيل في Supabase SQL Editor
-- =====================================================================
-- التشغيل: انسخ كامل هذا الملف والصقه في Supabase > SQL Editor > Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) تنظيف (احذف هذا القسم إن لم ترد إعادة الإنشاء من الصفر)
-- ---------------------------------------------------------------------
drop table if exists public.reports cascade;
drop table if exists public.payments cascade;
drop table if exists public.project_phases cascade;
drop table if exists public.projects cascade;
drop table if exists public.clients cascade;
drop table if exists public.profiles cascade;

drop type if exists user_role cascade;
drop type if exists client_status cascade;
drop type if exists project_status cascade;
drop type if exists phase_status cascade;
drop type if exists payment_type cascade;
drop type if exists payment_status cascade;
drop type if exists report_status cascade;

-- ---------------------------------------------------------------------
-- 1) أنواع البيانات (ENUM) المطابقة للقوائم المنسدلة
-- ---------------------------------------------------------------------

-- أدوار المستخدمين
create type user_role as enum ('مدير', 'مقيّم', 'مدخل بيانات');

-- حالة العميل
create type client_status as enum (
  'مهتم/قيد التواصل',
  'بانتظار موافقة العميل',
  'مفاوضات/تعديل عرض السعر',
  'مهم جداً/VIP',
  'عميل متكرر',
  'عميل محتمل',
  'غير نشط/توقف التواصل',
  'مرفوض/لا نتعامل معه'
);

-- حالة المشروع
create type project_status as enum (
  'مرحلة تحديد النطاق',
  'انتظار الدفعة الأولى',
  'مرحلة التنفيذ',
  'عمل التقارير',
  'انتظار الدفعة النهائية',
  'مكتمل/مؤرشف',
  'لاغٍ'
);

-- حالة مرحلة المشروع
create type phase_status as enum ('لم يتم البدء', 'جارٍ العمل', 'تم التنفيذ');

-- نوع الدفعة
create type payment_type as enum ('دفعة أولى', 'دفعة ثانية', 'دفعة ثالثة', 'دفعة رابعة', 'دفعة نهائية');

-- حالة الدفع
create type payment_status as enum (
  'بانتظار الدفعة المقدمة',
  'يحتاج إلى فاتورة',
  'متأخر عن السداد',
  'بانتظار الدفعة الأخيرة',
  'تم السداد بالكامل',
  'مدفوع ومغلق'
);

-- حالة التقرير
create type report_status as enum ('مسودة', 'تحت المراجعة', 'نهائي');

-- ---------------------------------------------------------------------
-- 2) جدول الملفات الشخصية (مرتبط بـ auth.users) - يحمل الدور
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null default '',
  email       text,
  role        user_role not null default 'مدخل بيانات',
  created_at  timestamptz not null default now()
);

-- دالة مساعدة: جلب دور المستخدم الحالي
create or replace function public.current_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- 3) جدول العملاء
-- ---------------------------------------------------------------------
create table public.clients (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,                 -- الاسم (عنوان)
  email           text,                          -- البريد الإلكتروني
  phone           text,                          -- رقم الهاتف
  status          client_status not null default 'مهتم/قيد التواصل', -- حالة العميل
  asset_type      text,                          -- نوع الأصول
  evaluation_purpose text,                        -- الغرض من التقييم
  external_evaluator text,                         -- مقيّم خارجي
  created_at      timestamptz not null default now(), -- تاريخ التسجيل (تلقائي)
  created_by      uuid references auth.users(id)
);

-- ---------------------------------------------------------------------
-- 4) جدول المشاريع
-- ---------------------------------------------------------------------
create table public.projects (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,                 -- اسم المشروع (عنوان)
  client_id       uuid references public.clients(id) on delete set null, -- العميل
  location        text,                          -- الموقع الجغرافي
  assets_count    integer default 0,             -- عدد الأصول
  budget          numeric(14,2) default 0,       -- ميزانية المشروع (SAR)
  manager         text,                          -- المسؤول (قائمة مفردة)
  assistants      text[] default '{}',           -- المعاونون (قائمة متعددة)
  start_date      date,                          -- تاريخ البدء
  delivery_date   date,                          -- تاريخ التسليم
  status          project_status not null default 'مرحلة تحديد النطاق', -- حالة المشروع
  completion_rate numeric(5,2) default 0,        -- معدل الاكتمال (محسوب تلقائياً)
  asset_files     text[] default '{}',           -- ملفات الأصول (روابط)
  quote_files     text[] default '{}',           -- ملفات عرض السعر (روابط)
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id)
);

-- ---------------------------------------------------------------------
-- 5) جدول مراحل المشاريع
-- ---------------------------------------------------------------------
create table public.project_phases (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references public.projects(id) on delete cascade, -- المشروع الرئيسي
  task_name     text not null,                   -- اسم المهمة (عنوان)
  assignee      text,                            -- المسؤول
  due_date      date,                            -- تاريخ الانتهاء
  status        phase_status not null default 'لم يتم البدء', -- الحالة
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id)
);

-- ---------------------------------------------------------------------
-- 6) جدول المدفوعات
-- ---------------------------------------------------------------------
create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,                 -- الاسم (عنوان)
  client_id       uuid references public.clients(id) on delete set null, -- العميل
  project_id      uuid references public.projects(id) on delete set null, -- المشروع التابع
  amount_due      numeric(14,2) default 0,       -- المبلغ المطلوب
  amount_paid     numeric(14,2) default 0,       -- المبلغ المدفوع
  amount_remaining numeric(14,2) generated always as (coalesce(amount_due,0) - coalesce(amount_paid,0)) stored, -- المتبقي (محسوب)
  type            payment_type not null default 'دفعة أولى', -- النوع
  status          payment_status not null default 'بانتظار الدفعة المقدمة', -- حالة الدفع
  invoice_number  text,                          -- رقم الفاتورة
  sent_date       date,                          -- تاريخ الإرسال
  paid_date       date,                          -- تاريخ الدفع
  attachments     text[] default '{}',           -- المرفقات
  created_at      timestamptz not null default now(),
  created_by      uuid references auth.users(id)
);

-- ---------------------------------------------------------------------
-- 7) جدول التقارير
-- ---------------------------------------------------------------------
create table public.reports (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,                   -- الاسم (عنوان)
  project_id    uuid references public.projects(id) on delete set null, -- المشروع التابع
  status        report_status not null default 'مسودة', -- حالة التقرير
  sent_date     date,                            -- تاريخ الإرسال
  files         text[] default '{}',             -- الملفات (مرفقات)
  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id)
);

-- ---------------------------------------------------------------------
-- 8) فهارس لتحسين الأداء
-- ---------------------------------------------------------------------
create index idx_projects_client      on public.projects(client_id);
create index idx_projects_status      on public.projects(status);
create index idx_phases_project       on public.project_phases(project_id);
create index idx_payments_client      on public.payments(client_id);
create index idx_payments_project     on public.payments(project_id);
create index idx_reports_project      on public.reports(project_id);

-- =====================================================================
-- 9) الحسابات التلقائية (Triggers) - معدل اكتمال المشروع (rollup)
-- =====================================================================
-- معدل الاكتمال = نسبة المراحل "تم التنفيذ" من إجمالي المراحل المرتبطة

create or replace function public.recompute_project_completion(p_project_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  total_count   integer;
  done_count    integer;
  rate          numeric(5,2);
begin
  select count(*) into total_count from public.project_phases where project_id = p_project_id;
  select count(*) into done_count  from public.project_phases where project_id = p_project_id and status = 'تم التنفيذ';

  if total_count = 0 then
    rate := 0;
  else
    rate := round((done_count::numeric / total_count::numeric) * 100, 2);
  end if;

  update public.projects set completion_rate = rate where id = p_project_id;
end;
$$;

-- trigger يُطلق عند أي تغيير في المراحل
create or replace function public.trg_phase_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'DELETE') then
    perform public.recompute_project_completion(old.project_id);
    return old;
  else
    perform public.recompute_project_completion(new.project_id);
    -- في حال نُقلت المرحلة لمشروع آخر، أعد حساب المشروع القديم أيضاً
    if (tg_op = 'UPDATE' and old.project_id is distinct from new.project_id) then
      perform public.recompute_project_completion(old.project_id);
    end if;
    return new;
  end if;
end;
$$;

create trigger phase_change_trigger
after insert or update or delete on public.project_phases
for each row execute function public.trg_phase_change();

-- =====================================================================
-- 10) إنشاء profile تلقائياً عند تسجيل مستخدم جديد
-- =====================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::user_role, 'مدخل بيانات')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- =====================================================================
-- 11) سياسات الأمان RLS (Row Level Security)
-- =====================================================================
-- ملاحظة: الـ backend (Hono) يستخدم service_role key الذي يتجاوز RLS.
-- لكن نفعّل RLS كطبقة حماية إضافية، ونسمح بالقراءة/الكتابة للمستخدمين المصادقين.
-- يتم فرض منطق الأدوار (مدير/مقيّم/مدخل بيانات) في طبقة الـ backend.

alter table public.profiles       enable row level security;
alter table public.clients        enable row level security;
alter table public.projects       enable row level security;
alter table public.project_phases enable row level security;
alter table public.payments       enable row level security;
alter table public.reports        enable row level security;

-- profiles: كل مستخدم يقرأ ملفه + المدير يقرأ الكل
create policy "profiles_select_own_or_admin" on public.profiles
  for select using (auth.uid() = id or public.current_role() = 'مدير');
create policy "profiles_update_admin" on public.profiles
  for update using (public.current_role() = 'مدير');

-- دالة مساعدة: هل المستخدم مصادق؟
-- العملاء، المشاريع، المراحل، المدفوعات، التقارير: القراءة لكل مصادق
create policy "clients_all_auth" on public.clients
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "projects_all_auth" on public.projects
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "phases_all_auth" on public.project_phases
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "payments_all_auth" on public.payments
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "reports_all_auth" on public.reports
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- =====================================================================
-- 12) بيانات أولية تجريبية (Seed Data)
-- =====================================================================
-- العملاء
insert into public.clients (id, name, email, phone, status, asset_type, evaluation_purpose, external_evaluator) values
  ('11111111-1111-1111-1111-111111111111', 'شركة المعدات الصناعية المتحدة', 'info@united-eq.sa', '0501234567', 'مهم جداً/VIP', 'آلات تصنيع ثقيلة', 'بيع / تصفية', 'مكتب الرواد'),
  ('22222222-2222-2222-2222-222222222222', 'مصنع الرياض للبلاستيك', 'contact@riyadh-plastic.sa', '0559876543', 'مفاوضات/تعديل عرض السعر', 'خطوط إنتاج', 'تمويل بنكي', null),
  ('33333333-3333-3333-3333-333333333333', 'مؤسسة الخليج للمقاولات', 'gulf@cont.sa', '0533219876', 'عميل متكرر', 'معدات إنشائية', 'تأمين', 'مكتب الإتقان'),
  ('44444444-4444-4444-4444-444444444444', 'شركة النقل السريع', 'fast@trans.sa', '0561122334', 'مهتم/قيد التواصل', 'أسطول شاحنات', 'بيع', null);

-- المشاريع
insert into public.projects (id, name, client_id, location, assets_count, budget, manager, assistants, start_date, delivery_date, status) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'تقييم آلات مصنع المعدات المتحدة', '11111111-1111-1111-1111-111111111111', 'الدمام - المنطقة الصناعية الثانية', 120, 85000, 'م. أحمد الفهد', ARRAY['سعد العتيبي','نورة القحطاني'], '2026-05-01', '2026-06-15', 'مرحلة التنفيذ'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'تقييم خطوط إنتاج البلاستيك', '22222222-2222-2222-2222-222222222222', 'الرياض - السلي', 45, 42000, 'م. خالد السالم', ARRAY['ليلى المطيري'], '2026-05-10', '2026-05-28', 'عمل التقارير'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'تقييم معدات الخليج الإنشائية', '33333333-3333-3333-3333-333333333333', 'جدة - حي الصناعية', 30, 30000, 'م. أحمد الفهد', ARRAY['سعد العتيبي'], '2026-04-15', '2026-05-20', 'انتظار الدفعة النهائية'),
  ('aaaaaaaa-0000-0000-0000-000000000004', 'تقييم أسطول النقل السريع', '44444444-4444-4444-4444-444444444444', 'الرياض - الخرج', 60, 55000, 'م. خالد السالم', ARRAY[]::text[], '2026-06-01', '2026-07-10', 'مرحلة تحديد النطاق');

-- مراحل المشاريع
insert into public.project_phases (project_id, task_name, assignee, due_date, status) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'حصر وتسجيل الأصول', 'سعد العتيبي', '2026-05-10', 'تم التنفيذ'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'المعاينة الميدانية', 'نورة القحطاني', '2026-05-20', 'تم التنفيذ'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'تحليل القيمة السوقية', 'م. أحمد الفهد', '2026-06-01', 'جارٍ العمل'),
  ('aaaaaaaa-0000-0000-0000-000000000001', 'إعداد التقرير النهائي', 'م. أحمد الفهد', '2026-06-12', 'لم يتم البدء'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'حصر خطوط الإنتاج', 'ليلى المطيري', '2026-05-15', 'تم التنفيذ'),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'إعداد التقرير', 'م. خالد السالم', '2026-05-25', 'جارٍ العمل'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'المعاينة', 'سعد العتيبي', '2026-04-25', 'تم التنفيذ'),
  ('aaaaaaaa-0000-0000-0000-000000000003', 'التقرير النهائي', 'م. أحمد الفهد', '2026-05-15', 'تم التنفيذ');

-- المدفوعات
insert into public.payments (name, client_id, project_id, amount_due, amount_paid, type, status, invoice_number, sent_date, paid_date) values
  ('دفعة مقدمة - المعدات المتحدة', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 42500, 42500, 'دفعة أولى', 'تم السداد بالكامل', 'INV-2026-001', '2026-05-02', '2026-05-05'),
  ('دفعة نهائية - المعدات المتحدة', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 42500, 0, 'دفعة نهائية', 'بانتظار الدفعة الأخيرة', null, null, null),
  ('دفعة أولى - البلاستيك', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000002', 21000, 21000, 'دفعة أولى', 'تم السداد بالكامل', 'INV-2026-002', '2026-05-11', '2026-05-13'),
  ('دفعة نهائية - البلاستيك', '22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000002', 21000, 0, 'دفعة نهائية', 'متأخر عن السداد', 'INV-2026-003', '2026-05-20', null),
  ('دفعة كاملة - الخليج', '33333333-3333-3333-3333-333333333333', 'aaaaaaaa-0000-0000-0000-000000000003', 30000, 15000, 'دفعة أولى', 'يحتاج إلى فاتورة', null, '2026-04-20', null);

-- التقارير
insert into public.reports (name, project_id, status, sent_date) values
  ('تقرير تقييم المعدات المتحدة', 'aaaaaaaa-0000-0000-0000-000000000001', 'مسودة', null),
  ('تقرير خطوط البلاستيك', 'aaaaaaaa-0000-0000-0000-000000000002', 'تحت المراجعة', null),
  ('تقرير معدات الخليج', 'aaaaaaaa-0000-0000-0000-000000000003', 'نهائي', '2026-05-16');

-- إعادة حساب معدلات الاكتمال للبيانات الأولية
select public.recompute_project_completion('aaaaaaaa-0000-0000-0000-000000000001');
select public.recompute_project_completion('aaaaaaaa-0000-0000-0000-000000000002');
select public.recompute_project_completion('aaaaaaaa-0000-0000-0000-000000000003');
select public.recompute_project_completion('aaaaaaaa-0000-0000-0000-000000000004');

-- =====================================================================
-- انتهى الملف. بعد التشغيل أنشئ مستخدمين من Supabase > Authentication > Users
-- ثم عدّل أدوارهم من جدول profiles (مثال أدناه):
--   update public.profiles set role = 'مدير' where email = 'admin@example.com';
-- =====================================================================
