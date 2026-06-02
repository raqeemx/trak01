/* =====================================================================
   نظام إدارة عمليات الجرد والتقييم - الواجهة الأمامية (SPA)
   ===================================================================== */

// ----------------------- الثوابت (متطابقة مع backend) -----------------------
const CLIENT_STATUS = ['مهتم/قيد التواصل','بانتظار موافقة العميل','مفاوضات/تعديل عرض السعر','مهم جداً/VIP','عميل متكرر','عميل محتمل','غير نشط/توقف التواصل','مرفوض/لا نتعامل معه'];
const PROJECT_STATUS = ['مرحلة تحديد النطاق','انتظار الدفعة الأولى','مرحلة التنفيذ','عمل التقارير','انتظار الدفعة النهائية','مكتمل/مؤرشف','لاغٍ'];
const ACTIVE_PROJECT_STATUS = ['مرحلة تحديد النطاق','انتظار الدفعة الأولى','مرحلة التنفيذ','عمل التقارير','انتظار الدفعة النهائية'];
const PHASE_STATUS = ['لم يتم البدء','جارٍ العمل','تم التنفيذ'];
const PAYMENT_TYPE = ['دفعة أولى','دفعة ثانية','دفعة ثالثة','دفعة رابعة','دفعة نهائية'];
const PAYMENT_STATUS = ['بانتظار الدفعة المقدمة','يحتاج إلى فاتورة','متأخر عن السداد','بانتظار الدفعة الأخيرة','تم السداد بالكامل','مدفوع ومغلق'];
const REPORT_STATUS = ['مسودة','تحت المراجعة','نهائي'];
const USER_ROLES = ['مدير','مقيّم','مدخل بيانات'];

const STATUS_COLORS = {
  'مهتم/قيد التواصل':'#3b82f6','بانتظار موافقة العميل':'#f59e0b','مفاوضات/تعديل عرض السعر':'#8b5cf6','مهم جداً/VIP':'#dc2626','عميل متكرر':'#10b981','عميل محتمل':'#06b6d4','غير نشط/توقف التواصل':'#6b7280','مرفوض/لا نتعامل معه':'#991b1b',
  'مرحلة تحديد النطاق':'#3b82f6','انتظار الدفعة الأولى':'#f59e0b','مرحلة التنفيذ':'#0ea5e9','عمل التقارير':'#8b5cf6','انتظار الدفعة النهائية':'#f97316','مكتمل/مؤرشف':'#10b981','لاغٍ':'#6b7280',
  'لم يتم البدء':'#6b7280','جارٍ العمل':'#0ea5e9','تم التنفيذ':'#10b981',
  'بانتظار الدفعة المقدمة':'#f59e0b','يحتاج إلى فاتورة':'#8b5cf6','متأخر عن السداد':'#dc2626','بانتظار الدفعة الأخيرة':'#f97316','تم السداد بالكامل':'#10b981','مدفوع ومغلق':'#059669',
  'مسودة':'#6b7280','تحت المراجعة':'#f59e0b','نهائي':'#10b981'
};

// ----------------------- أدوات مساعدة -----------------------
const $ = (sel, root=document) => root.querySelector(sel);
const fmtSAR = (n) => (Number(n)||0).toLocaleString('ar-SA',{maximumFractionDigits:2}) + ' ر.س';
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB') : '—';
const todayISO = () => new Date().toISOString().slice(0,10);
const esc = (s) => (s==null?'':String(s)).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const isOverdue = (date, status, doneStatuses=[]) => date && date < todayISO() && !doneStatuses.includes(status);

function badge(status){
  const c = STATUS_COLORS[status] || '#64748b';
  return `<span class="status-badge" style="background:${c}">${esc(status)}</span>`;
}

async function api(path, opts={}){
  const res = await fetch('/api'+path, {
    headers: {'Content-Type':'application/json'},
    credentials: 'same-origin',
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  let json = {};
  try { json = await res.json(); } catch(e){}
  if(!res.ok) throw new Error(json.error || 'حدث خطأ');
  return json;
}

function toast(msg, type='success'){
  const colors = {success:'#10b981',error:'#dc2626',info:'#0ea5e9'};
  const el = document.createElement('div');
  el.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-5 py-3 rounded-lg text-white shadow-lg fade-in';
  el.style.background = colors[type];
  el.innerHTML = `<i class="fas fa-${type==='error'?'circle-exclamation':'circle-check'} ml-2"></i>${esc(msg)}`;
  document.body.appendChild(el);
  setTimeout(()=>el.remove(), 3000);
}

// ----------------------- الحالة العامة -----------------------
const State = { user: null, route: 'dashboard', cache: {} };

// ----------------------- نقطة الدخول -----------------------
async function init(){
  try {
    const me = await api('/auth/me');
    State.user = me.user;
    renderShell();
    navigate(location.hash.replace('#','') || 'dashboard');
  } catch(e){
    renderLogin();
  }
}

window.addEventListener('hashchange', ()=>{
  if(State.user) navigate(location.hash.replace('#','') || 'dashboard');
});

document.addEventListener('DOMContentLoaded', init);

/* ===================== تسجيل الدخول ===================== */
function renderLogin(){
  $('#app').innerHTML = `
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-dark to-brand p-4">
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 fade-in">
      <div class="text-center mb-6">
        <div class="w-16 h-16 mx-auto bg-brand rounded-2xl flex items-center justify-center mb-3">
          <i class="fas fa-chart-line text-white text-2xl"></i>
        </div>
        <h1 class="text-xl font-extrabold text-slate-800">نظام إدارة عمليات الجرد والتقييم</h1>
        <p class="text-sm text-slate-500 mt-1">مكتب تقييم آلات ومعدات</p>
      </div>
      <form id="loginForm" class="space-y-4">
        <div>
          <label class="block text-sm font-semibold mb-1">البريد الإلكتروني</label>
          <input type="email" id="email" required class="w-full border border-slate-300 rounded-lg px-3 py-2.5" placeholder="admin@example.com" />
        </div>
        <div>
          <label class="block text-sm font-semibold mb-1">كلمة المرور</label>
          <input type="password" id="password" required class="w-full border border-slate-300 rounded-lg px-3 py-2.5" placeholder="••••••••" />
        </div>
        <button type="submit" class="w-full bg-brand hover:bg-brand-dark text-white font-bold py-2.5 rounded-lg transition">
          <i class="fas fa-right-to-bracket ml-2"></i>تسجيل الدخول
        </button>
        <p id="loginError" class="text-red-600 text-sm text-center hidden"></p>
      </form>
      <p class="text-xs text-slate-400 text-center mt-6">الأدوار: مدير · مقيّم · مدخل بيانات</p>
    </div>
  </div>`;

  $('#loginForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const btn = e.target.querySelector('button');
    btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الدخول...';
    try {
      const r = await api('/auth/login', {method:'POST', body:{email:$('#email').value, password:$('#password').value}});
      State.user = r.user;
      renderShell();
      navigate('dashboard');
    } catch(err){
      const el = $('#loginError'); el.textContent = err.message; el.classList.remove('hidden');
      btn.disabled = false; btn.innerHTML = '<i class="fas fa-right-to-bracket ml-2"></i>تسجيل الدخول';
    }
  });
}

/* ===================== الهيكل العام (Shell) ===================== */
const NAV = [
  {id:'dashboard', label:'الرئيسية', icon:'gauge-high'},
  {id:'clients', label:'العملاء', icon:'users'},
  {id:'projects', label:'المشاريع', icon:'diagram-project'},
  {id:'phases', label:'مراحل المشاريع', icon:'list-check'},
  {id:'payments', label:'المدفوعات', icon:'money-bill-wave'},
  {id:'reports', label:'التقارير', icon:'file-lines'},
];

function renderShell(){
  const isAdmin = State.user.role === 'مدير';
  $('#app').innerHTML = `
  <div class="flex min-h-screen">
    <!-- الشريط الجانبي -->
    <aside class="w-64 bg-brand-dark text-white flex flex-col fixed h-full right-0 z-40" id="sidebar">
      <div class="p-5 border-b border-white/10">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center"><i class="fas fa-chart-line"></i></div>
          <div><div class="font-extrabold text-sm leading-tight">إدارة الجرد والتقييم</div><div class="text-[11px] text-teal-200">مكتب تقييم المعدات</div></div>
        </div>
      </div>
      <nav class="flex-1 py-3 overflow-y-auto">
        ${NAV.map(n=>`<a href="#${n.id}" data-nav="${n.id}" class="nav-link flex items-center gap-3 px-5 py-3 text-sm hover:bg-white/10 transition"><i class="fas fa-${n.icon} w-5"></i>${n.label}</a>`).join('')}
        ${isAdmin?`<a href="#users" data-nav="users" class="nav-link flex items-center gap-3 px-5 py-3 text-sm hover:bg-white/10 transition"><i class="fas fa-user-gear w-5"></i>المستخدمون</a>`:''}
      </nav>
      <div class="p-4 border-t border-white/10">
        <div class="flex items-center gap-3 mb-3">
          <div class="w-9 h-9 bg-white/15 rounded-full flex items-center justify-center text-sm">${esc((State.user.full_name||State.user.email||'؟')[0])}</div>
          <div class="flex-1 min-w-0"><div class="text-sm font-semibold truncate">${esc(State.user.full_name||State.user.email)}</div><div class="text-[11px] text-teal-200">${esc(State.user.role)}</div></div>
        </div>
        <button onclick="logout()" class="w-full text-sm bg-white/10 hover:bg-white/20 py-2 rounded-lg"><i class="fas fa-right-from-bracket ml-1"></i>تسجيل الخروج</button>
      </div>
    </aside>
    <!-- المحتوى -->
    <main class="flex-1 mr-64 min-h-screen">
      <header class="bg-white shadow-sm px-6 py-4 flex items-center justify-between sticky top-0 z-30">
        <h2 id="pageTitle" class="text-lg font-extrabold text-slate-800"></h2>
        <div class="flex gap-2" id="quickActions"></div>
      </header>
      <div id="pageContent" class="p-6"></div>
    </main>
  </div>`;
}

async function logout(){
  await api('/auth/logout', {method:'POST'});
  State.user = null;
  location.hash = '';
  renderLogin();
}

function setActive(route){
  document.querySelectorAll('.nav-link').forEach(a=>a.classList.toggle('active', a.dataset.nav===route));
}

/* ===================== التوجيه ===================== */
function navigate(route){
  State.route = route;
  setActive(route);
  if(location.hash.replace('#','') !== route) location.hash = route;
  const content = $('#pageContent');
  content.innerHTML = '<div class="text-center py-20 text-slate-400"><i class="fas fa-spinner fa-spin text-3xl"></i></div>';
  const map = {
    dashboard: renderDashboard, clients: renderClients, projects: renderProjects,
    phases: renderPhases, payments: renderPayments, reports: renderReports, users: renderUsers
  };
  (map[route] || renderDashboard)();
}

/* ===================== نظام النوافذ المنبثقة (Modal) ===================== */
function openModal(title, bodyHTML, onSubmit){
  closeModal();
  const wrap = document.createElement('div');
  wrap.id = 'modal';
  wrap.className = 'fixed inset-0 bg-black/40 modal-overlay z-[90] flex items-start justify-center p-4 overflow-y-auto';
  wrap.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-8 fade-in" onclick="event.stopPropagation()">
      <div class="flex items-center justify-between px-6 py-4 border-b">
        <h3 class="font-extrabold text-slate-800">${esc(title)}</h3>
        <button onclick="closeModal()" class="text-slate-400 hover:text-slate-700"><i class="fas fa-xmark text-xl"></i></button>
      </div>
      <form id="modalForm" class="p-6 space-y-4">${bodyHTML}
        <div class="flex gap-3 pt-2 border-t mt-4">
          <button type="submit" class="bg-brand hover:bg-brand-dark text-white font-bold px-5 py-2.5 rounded-lg"><i class="fas fa-check ml-1"></i>حفظ</button>
          <button type="button" onclick="closeModal()" class="bg-slate-100 hover:bg-slate-200 px-5 py-2.5 rounded-lg">إلغاء</button>
        </div>
      </form>
    </div>`;
  wrap.addEventListener('click', closeModal);
  document.body.appendChild(wrap);
  $('#modalForm').addEventListener('submit', async (e)=>{
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; const orig = btn.innerHTML; btn.innerHTML='<i class="fas fa-spinner fa-spin"></i> حفظ...';
    try { await onSubmit(new FormData(e.target)); closeModal(); }
    catch(err){ toast(err.message,'error'); btn.disabled=false; btn.innerHTML=orig; }
  });
}
function closeModal(){ const m=$('#modal'); if(m) m.remove(); }

// مولّدات حقول النموذج
function fInput(name,label,val='',type='text',req=false){
  return `<div><label class="block text-sm font-semibold mb-1">${label}</label><input name="${name}" type="${type}" value="${esc(val)}" ${req?'required':''} class="w-full border border-slate-300 rounded-lg px-3 py-2" /></div>`;
}
function fTextarea(name,label,val=''){
  return `<div><label class="block text-sm font-semibold mb-1">${label}</label><textarea name="${name}" rows="2" class="w-full border border-slate-300 rounded-lg px-3 py-2">${esc(val)}</textarea></div>`;
}
function fSelect(name,label,options,val=''){
  return `<div><label class="block text-sm font-semibold mb-1">${label}</label><select name="${name}" class="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white">${options.map(o=>{
    const v = typeof o==='object'?o.value:o; const t = typeof o==='object'?o.label:o;
    return `<option value="${esc(v)}" ${String(v)===String(val)?'selected':''}>${esc(t)}</option>`;
  }).join('')}</select></div>`;
}

// صلاحيات
const can = {
  create: () => ['مدير','مقيّم','مدخل بيانات'].includes(State.user.role),
  edit: () => ['مدير','مقيّم'].includes(State.user.role),
  del: () => State.user.role==='مدير'
};

// زر أوامر سريعة
function quickBtn(label,icon,fn){
  return `<button onclick="${fn}" class="bg-brand hover:bg-brand-dark text-white text-sm font-semibold px-4 py-2 rounded-lg"><i class="fas fa-${icon} ml-1"></i>${label}</button>`;
}

// شريط بحث/فلترة عام
function searchBar(id, placeholder, filterOptions){
  return `<div class="flex flex-wrap gap-3 mb-4">
    <div class="relative flex-1 min-w-[200px]">
      <i class="fas fa-search absolute right-3 top-3 text-slate-400"></i>
      <input id="${id}_search" placeholder="${placeholder}" class="w-full border border-slate-300 rounded-lg pr-9 pl-3 py-2" />
    </div>
    ${filterOptions ? `<select id="${id}_filter" class="border border-slate-300 rounded-lg px-3 py-2 bg-white"><option value="">كل الحالات</option>${filterOptions.map(o=>`<option value="${esc(o)}">${esc(o)}</option>`).join('')}</select>`:''}
  </div>`;
}

/* ===================== الصفحة الرئيسية (Dashboard) ===================== */
async function renderDashboard(){
  $('#pageTitle').textContent = 'لوحة المتابعة التشغيلية';
  $('#quickActions').innerHTML = '';
  const d = await api('/dashboard');

  const card = (title,value,sub,icon,color,alert) => `
    <div class="bg-white rounded-2xl shadow-sm p-5 fade-in ${alert?'overdue-glow':''}">
      <div class="flex items-center justify-between mb-3">
        <div class="w-11 h-11 rounded-xl flex items-center justify-center text-white" style="background:${color}"><i class="fas fa-${icon}"></i></div>
        ${alert?`<span class="text-xs bg-red-100 text-red-700 font-bold px-2 py-1 rounded-full"><i class="fas fa-triangle-exclamation"></i> ${alert}</span>`:''}
      </div>
      <div class="text-3xl font-extrabold text-slate-800">${value}</div>
      <div class="text-sm font-semibold text-slate-600 mt-1">${title}</div>
      <div class="text-xs text-slate-400 mt-1">${sub}</div>
    </div>`;

  $('#pageContent').innerHTML = `
    <!-- شريط الأوامر السريعة -->
    <div class="bg-white rounded-2xl shadow-sm p-4 mb-6 flex flex-wrap items-center gap-3">
      <span class="font-bold text-slate-700 text-sm"><i class="fas fa-bolt text-amber-500 ml-1"></i>أوامر سريعة:</span>
      ${quickBtn('إضافة عميل','user-plus','clientForm()')}
      ${quickBtn('إضافة مشروع','folder-plus','projectForm()')}
      ${quickBtn('إضافة دفعة','money-check-dollar','paymentForm()')}
      ${quickBtn('إضافة تقرير','file-circle-plus','reportForm()')}
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-6">
      ${card('العملاء النشطون', d.activeClients, `إجمالي العملاء: ${d.totalClients}`, 'users', '#0ea5e9')}
      ${card('المشاريع الفعّالة', d.activeProjects, 'قيد التنفيذ', 'diagram-project', '#0f766e', d.overdueProjects?`${d.overdueProjects} متأخر`:'')}
      ${card('المدفوعات المعلّقة', d.pendingPayments, fmtSAR(d.pendingAmount), 'money-bill-wave', '#f59e0b', d.overduePayments?`${d.overduePayments} متأخر`:'')}
      ${card('التقارير قيد العمل', d.workingReports, `إجمالي التقارير: ${d.totalReports}`, 'file-lines', '#8b5cf6')}
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
      ${[['العملاء','users','clients','#0ea5e9'],['المشاريع','diagram-project','projects','#0f766e'],['المراحل','list-check','phases','#6366f1'],['المدفوعات','money-bill-wave','payments','#f59e0b'],['التقارير','file-lines','reports','#8b5cf6']].map(([l,i,r,c])=>`
        <a href="#${r}" class="bg-white rounded-2xl shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition">
          <div class="w-12 h-12 rounded-xl flex items-center justify-center text-white" style="background:${c}"><i class="fas fa-${i} text-lg"></i></div>
          <div><div class="font-bold text-slate-800">${l}</div><div class="text-xs text-slate-400">انتقل إلى القسم</div></div>
          <i class="fas fa-chevron-left text-slate-300 mr-auto"></i>
        </a>`).join('')}
    </div>`;
}

/* ===================== العملاء ===================== */
async function renderClients(){
  $('#pageTitle').textContent = 'العملاء';
  $('#quickActions').innerHTML = can.create()?quickBtn('إضافة عميل','user-plus','clientForm()'):'';
  const {data} = await api('/clients');
  State.cache.clients = data;

  $('#pageContent').innerHTML = searchBar('cl','بحث بالاسم أو البريد أو الهاتف...', CLIENT_STATUS) +
    `<div class="bg-white rounded-2xl shadow-sm overflow-hidden"><div class="overflow-x-auto"><table class="w-full text-sm" id="cl_table">
      <thead class="bg-slate-50 text-slate-600"><tr>
        <th class="text-right p-3">الاسم</th><th class="text-right p-3">الحالة</th><th class="text-right p-3">الهاتف</th>
        <th class="text-right p-3">البريد</th><th class="text-right p-3">نوع الأصول</th><th class="text-right p-3">التسجيل</th><th class="p-3">إجراءات</th>
      </tr></thead><tbody></tbody></table></div></div>`;

  const draw = () => {
    const q = ($('#cl_search').value||'').trim();
    const f = $('#cl_filter').value;
    const rows = data.filter(c=>(!f||c.status===f) && (!q || [c.name,c.email,c.phone].some(x=>(x||'').includes(q))));
    $('#cl_table tbody').innerHTML = rows.length?rows.map(c=>`<tr class="border-t hover:bg-slate-50">
      <td class="p-3 font-semibold">${esc(c.name)}</td>
      <td class="p-3">${badge(c.status)}</td>
      <td class="p-3">${esc(c.phone||'—')}</td>
      <td class="p-3 text-slate-500">${esc(c.email||'—')}</td>
      <td class="p-3">${esc(c.asset_type||'—')}</td>
      <td class="p-3 text-slate-400">${fmtDate(c.created_at)}</td>
      <td class="p-3 whitespace-nowrap text-center">
        ${can.create()?`<button onclick="startProject('${c.id}')" title="بدء مشروع" class="text-emerald-600 hover:bg-emerald-50 px-2 py-1 rounded"><i class="fas fa-rocket"></i></button>`:''}
        ${can.edit()?`<button onclick="clientForm('${c.id}')" title="تعديل" class="text-sky-600 hover:bg-sky-50 px-2 py-1 rounded"><i class="fas fa-pen"></i></button>`:''}
        ${can.del()?`<button onclick="delItem('clients','${c.id}',renderClients)" title="حذف" class="text-red-600 hover:bg-red-50 px-2 py-1 rounded"><i class="fas fa-trash"></i></button>`:''}
      </td></tr>`).join(''):`<tr><td colspan="7" class="p-8 text-center text-slate-400">لا توجد بيانات</td></tr>`;
  };
  $('#cl_search').addEventListener('input',draw); $('#cl_filter').addEventListener('change',draw); draw();
}

function clientForm(id){
  const c = id ? State.cache.clients.find(x=>x.id===id) : {};
  openModal(id?'تعديل عميل':'إضافة عميل', `
    ${fInput('name','الاسم',c.name,'text',true)}
    <div class="grid grid-cols-2 gap-4">${fInput('email','البريد الإلكتروني',c.email,'email')}${fInput('phone','رقم الهاتف',c.phone)}</div>
    ${fSelect('status','حالة العميل',CLIENT_STATUS,c.status||CLIENT_STATUS[0])}
    <div class="grid grid-cols-2 gap-4">${fInput('asset_type','نوع الأصول',c.asset_type)}${fInput('evaluation_purpose','الغرض من التقييم',c.evaluation_purpose)}</div>
    ${fInput('external_evaluator','مقيّم خارجي',c.external_evaluator)}
  `, async (fd)=>{
    const body = Object.fromEntries(fd);
    if(id) await api('/clients/'+id,{method:'PUT',body});
    else await api('/clients',{method:'POST',body});
    toast('تم الحفظ'); renderClients();
  });
}

async function startProject(clientId){
  const name = prompt('اسم المشروع الجديد:');
  if(name===null) return;
  try { await api(`/clients/${clientId}/start-project`,{method:'POST',body:{name}}); toast('تم إنشاء المشروع'); navigate('projects'); }
  catch(e){ toast(e.message,'error'); }
}

async function delItem(table,id,cb){
  if(!confirm('هل أنت متأكد من الحذف؟')) return;
  try { await api(`/${table}/${id}`,{method:'DELETE'}); toast('تم الحذف'); cb(); }
  catch(e){ toast(e.message,'error'); }
}

/* ===================== المشاريع (4 عروض) ===================== */
let projView = 'table';
let calMode = 'month';
let calRef = new Date();

async function renderProjects(){
  $('#pageTitle').textContent = 'المشاريع';
  $('#quickActions').innerHTML = can.create()?quickBtn('إضافة مشروع','folder-plus','projectForm()'):'';
  const {data} = await api('/projects');
  State.cache.projects = data;
  if(!State.cache.clients){ try{State.cache.clients=(await api('/clients')).data;}catch(e){State.cache.clients=[];} }

  const tabs = [['table','جدول','table'],['board','لوحة','columns'],['calendar','تقويم','calendar-days'],['gallery','معرض','images']];
  $('#pageContent').innerHTML = `
    <div class="flex flex-wrap gap-2 mb-4 bg-white p-1.5 rounded-xl shadow-sm w-fit">
      ${tabs.map(([v,l,i])=>`<button onclick="setProjView('${v}')" data-pv="${v}" class="proj-tab px-4 py-2 rounded-lg text-sm font-semibold ${projView===v?'bg-brand text-white':'text-slate-600 hover:bg-slate-100'}"><i class="fas fa-${i} ml-1"></i>${l}</button>`).join('')}
    </div>
    <div id="proj_view"></div>`;
  drawProjView();
}

function setProjView(v){ projView=v; document.querySelectorAll('.proj-tab').forEach(b=>{const a=b.dataset.pv===v;b.className=`proj-tab px-4 py-2 rounded-lg text-sm font-semibold ${a?'bg-brand text-white':'text-slate-600 hover:bg-slate-100'}`;}); drawProjView(); }

function clientName(id){ const c=(State.cache.clients||[]).find(x=>x.id===id); return c?c.name:'—'; }

function drawProjView(){
  const data = State.cache.projects;
  const v = $('#proj_view');
  if(projView==='table') v.innerHTML = projTable(data);
  else if(projView==='board') v.innerHTML = projBoard(data);
  else if(projView==='calendar') v.innerHTML = projCalendar(data);
  else v.innerHTML = projGallery(data);
  if(projView==='table'){
    const draw=()=>{const q=($('#pj_search').value||'').trim();const f=$('#pj_filter').value;
      const rows=data.filter(p=>(!f||p.status===f)&&(!q||(p.name||'').includes(q)||clientName(p.client_id).includes(q)));
      $('#pj_table tbody').innerHTML=projRows(rows);};
    $('#pj_search').addEventListener('input',draw);$('#pj_filter').addEventListener('change',draw);
  }
}

function projRows(rows){
  if(!rows.length) return `<tr><td colspan="8" class="p-8 text-center text-slate-400">لا توجد بيانات</td></tr>`;
  return rows.map(p=>{
    const over=isOverdue(p.delivery_date,p.status,['مكتمل/مؤرشف','لاغٍ']);
    return `<tr class="border-t hover:bg-slate-50 ${over?'overdue-row':''}">
      <td class="p-3 font-semibold">${esc(p.name)} ${over?'<i class="fas fa-triangle-exclamation text-red-500 mr-1" title="متأخر"></i>':''}</td>
      <td class="p-3">${esc(clientName(p.client_id))}</td>
      <td class="p-3">${badge(p.status)}</td>
      <td class="p-3"><div class="flex items-center gap-2"><div class="flex-1 bg-slate-200 rounded-full h-2 w-20"><div class="bg-emerald-500 h-2 rounded-full" style="width:${p.completion_rate||0}%"></div></div><span class="text-xs">${p.completion_rate||0}%</span></div></td>
      <td class="p-3">${esc(p.location||'—')}</td>
      <td class="p-3">${fmtSAR(p.budget)}</td>
      <td class="p-3 ${over?'text-red-600 font-bold':''}">${fmtDate(p.delivery_date)}</td>
      <td class="p-3 text-center whitespace-nowrap">
        <button onclick="projectDetail('${p.id}')" title="تفاصيل" class="text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded"><i class="fas fa-eye"></i></button>
        ${can.edit()?`<button onclick="projectForm('${p.id}')" class="text-sky-600 hover:bg-sky-50 px-2 py-1 rounded"><i class="fas fa-pen"></i></button>`:''}
        ${can.del()?`<button onclick="delItem('projects','${p.id}',renderProjects)" class="text-red-600 hover:bg-red-50 px-2 py-1 rounded"><i class="fas fa-trash"></i></button>`:''}
      </td></tr>`;
  }).join('');
}

function projTable(data){
  return searchBar('pj','بحث باسم المشروع أو العميل...',PROJECT_STATUS)+
  `<div class="bg-white rounded-2xl shadow-sm overflow-hidden"><div class="overflow-x-auto"><table class="w-full text-sm" id="pj_table">
    <thead class="bg-slate-50 text-slate-600"><tr>
      <th class="text-right p-3">المشروع</th><th class="text-right p-3">العميل</th><th class="text-right p-3">الحالة</th>
      <th class="text-right p-3">الاكتمال</th><th class="text-right p-3">الموقع</th><th class="text-right p-3">الميزانية</th>
      <th class="text-right p-3">التسليم</th><th class="p-3">إجراءات</th>
    </tr></thead><tbody>${projRows(data)}</tbody></table></div></div>`;
}

/* ----- عرض اللوحة (Board) مجمّع حسب الحالة ----- */
function projBoard(data){
  return `<div class="flex gap-4 overflow-x-auto pb-4">${PROJECT_STATUS.map(st=>{
    const items=data.filter(p=>p.status===st);
    const c=STATUS_COLORS[st];
    return `<div class="board-col bg-slate-50 rounded-xl p-3 flex-shrink-0">
      <div class="flex items-center justify-between mb-3 pb-2 border-b" style="border-color:${c}">
        <span class="font-bold text-sm" style="color:${c}">${esc(st)}</span>
        <span class="text-xs bg-white px-2 py-0.5 rounded-full">${items.length}</span>
      </div>
      <div class="space-y-2">${items.length?items.map(p=>{
        const over=isOverdue(p.delivery_date,p.status,['مكتمل/مؤرشف','لاغٍ']);
        return `<div onclick="projectDetail('${p.id}')" class="bg-white rounded-lg p-3 shadow-sm cursor-pointer hover:shadow-md ${over?'overdue-glow':''}">
          <div class="font-semibold text-sm mb-1">${esc(p.name)}</div>
          <div class="text-xs text-slate-500 mb-2"><i class="fas fa-user ml-1"></i>${esc(clientName(p.client_id))}</div>
          <div class="bg-slate-200 rounded-full h-1.5 mb-2"><div class="bg-emerald-500 h-1.5 rounded-full" style="width:${p.completion_rate||0}%"></div></div>
          <div class="flex justify-between text-xs text-slate-400"><span><i class="fas fa-calendar-day ml-1"></i>${fmtDate(p.delivery_date)}</span><span>${p.completion_rate||0}%</span></div>
        </div>`;}).join(''):'<div class="text-center text-xs text-slate-300 py-4">فارغ</div>'}</div>
    </div>`;
  }).join('')}</div>`;
}

/* ----- عرض التقويم (أسبوعي/شهري) حسب تاريخ التسليم ----- */
function projCalendar(data){
  return `<div class="bg-white rounded-2xl shadow-sm p-4">
    <div class="flex items-center justify-between mb-4">
      <div class="flex gap-2">
        <button onclick="setCalMode('month')" class="px-3 py-1.5 rounded-lg text-sm font-semibold ${calMode==='month'?'bg-brand text-white':'bg-slate-100'}">شهري</button>
        <button onclick="setCalMode('week')" class="px-3 py-1.5 rounded-lg text-sm font-semibold ${calMode==='week'?'bg-brand text-white':'bg-slate-100'}">أسبوعي</button>
      </div>
      <div class="flex items-center gap-3">
        <button onclick="calNav(-1)" class="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200"><i class="fas fa-chevron-right"></i></button>
        <span class="font-bold text-sm">${calTitle()}</span>
        <button onclick="calNav(1)" class="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200"><i class="fas fa-chevron-left"></i></button>
        <button onclick="calToday()" class="px-3 py-1.5 rounded-lg text-sm bg-slate-100 hover:bg-slate-200">اليوم</button>
      </div>
    </div>
    ${calMode==='month'?calMonth(data):calWeek(data)}
  </div>`;
}
function setCalMode(m){calMode=m;drawProjView();}
function calNav(d){ if(calMode==='month'){calRef.setMonth(calRef.getMonth()+d);}else{calRef.setDate(calRef.getDate()+d*7);} drawProjView(); }
function calToday(){calRef=new Date();drawProjView();}
function calTitle(){
  if(calMode==='month') return calRef.toLocaleDateString('ar-EG',{month:'long',year:'numeric'});
  const s=startOfWeek(calRef); const e=new Date(s); e.setDate(e.getDate()+6);
  return `${fmtDate(s.toISOString())} — ${fmtDate(e.toISOString())}`;
}
function startOfWeek(d){const x=new Date(d);x.setDate(x.getDate()-x.getDay());x.setHours(0,0,0,0);return x;}
function projsOn(data,iso){return data.filter(p=>p.delivery_date===iso);}
function dayCell(data,date){
  const iso=date.toISOString().slice(0,10);
  const items=projsOn(data,iso);
  const isToday=iso===todayISO();
  return `<div class="border border-slate-100 min-h-[90px] p-1.5 ${isToday?'bg-teal-50':''}">
    <div class="text-xs font-bold ${isToday?'text-brand':'text-slate-400'} mb-1">${date.getDate()}</div>
    ${items.map(p=>{const over=isOverdue(p.delivery_date,p.status,['مكتمل/مؤرشف','لاغٍ']);
      return `<div onclick="projectDetail('${p.id}')" class="text-[11px] mb-1 px-1.5 py-1 rounded cursor-pointer text-white truncate" style="background:${over?'#dc2626':STATUS_COLORS[p.status]}" title="${esc(p.name)}">${esc(p.name)}</div>`;}).join('')}
  </div>`;
}
function calMonth(data){
  const y=calRef.getFullYear(),m=calRef.getMonth();
  const first=new Date(y,m,1); const start=new Date(first); start.setDate(start.getDate()-first.getDay());
  const days=['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  let cells='';
  for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);cells+=dayCell(data,d);}
  return `<div class="grid grid-cols-7 text-center text-xs font-bold text-slate-500 mb-1">${days.map(d=>`<div class="py-1">${d}</div>`).join('')}</div><div class="grid grid-cols-7">${cells}</div>`;
}
function calWeek(data){
  const s=startOfWeek(calRef);
  const days=['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  let head='',cells='';
  for(let i=0;i<7;i++){const d=new Date(s);d.setDate(s.getDate()+i);head+=`<div class="py-1 text-center text-xs font-bold text-slate-500">${days[i]} ${d.getDate()}</div>`;cells+=dayCell(data,d);}
  return `<div class="grid grid-cols-7">${head}</div><div class="grid grid-cols-7">${cells}</div>`;
}

/* ----- عرض المعرض (Gallery) للمشاريع النشطة ----- */
function projGallery(data){
  const items=data.filter(p=>ACTIVE_PROJECT_STATUS.includes(p.status));
  if(!items.length) return `<div class="bg-white rounded-2xl shadow-sm p-12 text-center text-slate-400">لا توجد مشاريع نشطة</div>`;
  return `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">${items.map(p=>{
    const over=isOverdue(p.delivery_date,p.status,['مكتمل/مؤرشف','لاغٍ']);
    const c=STATUS_COLORS[p.status];
    return `<div onclick="projectDetail('${p.id}')" class="gallery-card bg-white rounded-2xl shadow-sm overflow-hidden cursor-pointer ${over?'overdue-glow':''}">
      <div class="h-2" style="background:${c}"></div>
      <div class="p-5">
        <div class="flex items-start justify-between mb-2"><h3 class="font-extrabold text-slate-800">${esc(p.name)}</h3>${over?'<i class="fas fa-triangle-exclamation text-red-500"></i>':''}</div>
        <div class="text-sm text-slate-500 mb-3"><i class="fas fa-user ml-1"></i>${esc(clientName(p.client_id))}</div>
        ${badge(p.status)}
        <div class="mt-4"><div class="flex justify-between text-xs mb-1"><span>الاكتمال</span><span class="font-bold">${p.completion_rate||0}%</span></div>
          <div class="bg-slate-200 rounded-full h-2"><div class="bg-emerald-500 h-2 rounded-full" style="width:${p.completion_rate||0}%"></div></div></div>
        <div class="grid grid-cols-2 gap-3 mt-4 text-xs text-slate-500">
          <div><i class="fas fa-location-dot ml-1 text-slate-400"></i>${esc(p.location||'—')}</div>
          <div><i class="fas fa-coins ml-1 text-slate-400"></i>${fmtSAR(p.budget)}</div>
          <div><i class="fas fa-cubes ml-1 text-slate-400"></i>${p.assets_count||0} أصل</div>
          <div class="${over?'text-red-600 font-bold':''}"><i class="fas fa-calendar-day ml-1"></i>${fmtDate(p.delivery_date)}</div>
        </div>
      </div>
    </div>`;}).join('')}</div>`;
}

/* ----- نموذج المشروع ----- */
async function projectForm(id){
  if(!State.cache.clients){ try{State.cache.clients=(await api('/clients')).data;}catch(e){State.cache.clients=[];} }
  const p = id ? (State.cache.projects||[]).find(x=>x.id===id) : {};
  const clientOpts = (State.cache.clients||[]).map(c=>({value:c.id,label:c.name}));
  openModal(id?'تعديل مشروع':'إضافة مشروع', `
    ${fInput('name','اسم المشروع',p.name,'text',true)}
    <div class="grid grid-cols-2 gap-4">${fSelect('client_id','العميل',[{value:'',label:'— بدون —'},...clientOpts],p.client_id||'')}${fInput('location','الموقع الجغرافي',p.location)}</div>
    <div class="grid grid-cols-2 gap-4">${fInput('assets_count','عدد الأصول',p.assets_count||0,'number')}${fInput('budget','ميزانية المشروع (ر.س)',p.budget||0,'number')}</div>
    <div class="grid grid-cols-2 gap-4">${fInput('manager','المسؤول',p.manager)}${fInput('assistants_str','المعاونون (افصل بفاصلة)',(p.assistants||[]).join('، '))}</div>
    <div class="grid grid-cols-2 gap-4">${fInput('start_date','تاريخ البدء',p.start_date,'date')}${fInput('delivery_date','تاريخ التسليم',p.delivery_date,'date')}</div>
    ${fSelect('status','حالة المشروع',PROJECT_STATUS,p.status||PROJECT_STATUS[0])}
  `, async (fd)=>{
    const body = Object.fromEntries(fd);
    body.assets_count = Number(body.assets_count)||0;
    body.budget = Number(body.budget)||0;
    body.assistants = (body.assistants_str||'').split(/[،,]/).map(s=>s.trim()).filter(Boolean);
    delete body.assistants_str;
    if(!body.client_id) body.client_id=null;
    if(!body.start_date) body.start_date=null;
    if(!body.delivery_date) body.delivery_date=null;
    if(id) await api('/projects/'+id,{method:'PUT',body});
    else await api('/projects',{method:'POST',body});
    toast('تم الحفظ'); renderProjects();
  });
}

/* ----- صفحة تفاصيل المشروع (المراحل + المدفوعات + التقارير) ----- */
async function projectDetail(id){
  closeModal();
  const r = await api(`/projects/${id}/full`);
  const p = r.project;
  const over=isOverdue(p.delivery_date,p.status,['مكتمل/مؤرشف','لاغٍ']);
  const body = `
    <div class="space-y-5 text-sm">
      <div class="flex flex-wrap gap-3 items-center">
        ${badge(p.status)}
        <span class="text-slate-500"><i class="fas fa-user ml-1"></i>${esc(p.clients?.name||'—')}</span>
        <span class="text-slate-500"><i class="fas fa-location-dot ml-1"></i>${esc(p.location||'—')}</span>
        <span class="text-slate-500"><i class="fas fa-coins ml-1"></i>${fmtSAR(p.budget)}</span>
        ${over?'<span class="text-red-600 font-bold"><i class="fas fa-triangle-exclamation ml-1"></i>متأخر عن التسليم</span>':''}
      </div>
      <div class="grid grid-cols-2 gap-4 bg-slate-50 rounded-xl p-4">
        <div><span class="text-slate-400">المسؤول:</span> ${esc(p.manager||'—')}</div>
        <div><span class="text-slate-400">المعاونون:</span> ${esc((p.assistants||[]).join('، ')||'—')}</div>
        <div><span class="text-slate-400">عدد الأصول:</span> ${p.assets_count||0}</div>
        <div><span class="text-slate-400">التسليم:</span> ${fmtDate(p.delivery_date)}</div>
        <div class="col-span-2"><span class="text-slate-400">معدل الاكتمال:</span> <strong>${p.completion_rate||0}%</strong>
          <div class="bg-slate-200 rounded-full h-2 mt-1"><div class="bg-emerald-500 h-2 rounded-full" style="width:${p.completion_rate||0}%"></div></div></div>
      </div>

      <div>
        <div class="flex items-center justify-between mb-2"><h4 class="font-bold"><i class="fas fa-list-check ml-1"></i>المراحل (${r.phases.length})</h4>
          ${can.create()?`<button onclick="phaseForm(null,'${id}')" class="text-xs bg-brand text-white px-3 py-1.5 rounded-lg"><i class="fas fa-plus ml-1"></i>مرحلة</button>`:''}</div>
        <div class="space-y-2">${r.phases.length?r.phases.map(ph=>{const o=isOverdue(ph.due_date,ph.status,['تم التنفيذ']);
          return `<div class="flex items-center justify-between bg-white border rounded-lg p-2.5 ${o?'overdue-row':''}">
            <div><div class="font-semibold">${esc(ph.task_name)}</div><div class="text-xs text-slate-400">${esc(ph.assignee||'—')} · ${fmtDate(ph.due_date)}</div></div>
            <div class="flex items-center gap-2">${badge(ph.status)}
              ${can.edit()?`<button onclick="phaseForm('${ph.id}','${id}')" class="text-sky-600 px-1"><i class="fas fa-pen text-xs"></i></button>`:''}
              ${can.del()?`<button onclick="delPhaseInDetail('${ph.id}','${id}')" class="text-red-600 px-1"><i class="fas fa-trash text-xs"></i></button>`:''}
            </div></div>`;}).join(''):'<div class="text-slate-400 text-xs">لا مراحل</div>'}</div>
      </div>

      <div class="grid grid-cols-2 gap-4">
        <div><h4 class="font-bold mb-2"><i class="fas fa-money-bill-wave ml-1"></i>المدفوعات</h4>
          <div class="space-y-2">${r.payments.length?r.payments.map(pa=>`<div class="bg-white border rounded-lg p-2 text-xs"><div class="font-semibold">${esc(pa.name)}</div><div>${fmtSAR(pa.amount_paid)} / ${fmtSAR(pa.amount_due)}</div>${badge(pa.status)}</div>`).join(''):'<div class="text-slate-400 text-xs">لا مدفوعات</div>'}</div></div>
        <div><h4 class="font-bold mb-2"><i class="fas fa-file-lines ml-1"></i>التقارير</h4>
          <div class="space-y-2">${r.reports.length?r.reports.map(rp=>`<div class="bg-white border rounded-lg p-2 text-xs"><div class="font-semibold">${esc(rp.name)}</div>${badge(rp.status)}</div>`).join(''):'<div class="text-slate-400 text-xs">لا تقارير</div>'}</div></div>
      </div>
    </div>`;

  const wrap=document.createElement('div');
  wrap.id='modal'; wrap.className='fixed inset-0 bg-black/40 modal-overlay z-[90] flex items-start justify-center p-4 overflow-y-auto';
  wrap.innerHTML=`<div class="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-8 fade-in" onclick="event.stopPropagation()">
    <div class="flex items-center justify-between px-6 py-4 border-b"><h3 class="font-extrabold">${esc(p.name)}</h3>
      <button onclick="closeModal()" class="text-slate-400 hover:text-slate-700"><i class="fas fa-xmark text-xl"></i></button></div>
    <div class="p-6">${body}</div></div>`;
  wrap.addEventListener('click',closeModal);
  document.body.appendChild(wrap);
}
async function delPhaseInDetail(phId,projId){ if(!confirm('حذف المرحلة؟'))return; await api('/phases/'+phId,{method:'DELETE'}); toast('تم الحذف'); projectDetail(projId); if(State.route==='projects')renderProjects(); }

/* ===================== مراحل المشاريع ===================== */
async function renderPhases(){
  $('#pageTitle').textContent='مراحل المشاريع';
  $('#quickActions').innerHTML = can.create()?quickBtn('إضافة مرحلة','plus','phaseForm()'):'';
  const [{data:phases},{data:projects}] = await Promise.all([api('/phases'),api('/projects')]);
  State.cache.phases=phases; State.cache.projects=projects;
  const pname=(pid)=>{const p=projects.find(x=>x.id===pid);return p?p.name:'—';};

  $('#pageContent').innerHTML = searchBar('ph','بحث باسم المهمة أو المسؤول...',PHASE_STATUS)+
  `<div class="bg-white rounded-2xl shadow-sm overflow-hidden"><div class="overflow-x-auto"><table class="w-full text-sm" id="ph_table">
    <thead class="bg-slate-50 text-slate-600"><tr><th class="text-right p-3">المهمة</th><th class="text-right p-3">المشروع</th>
    <th class="text-right p-3">المسؤول</th><th class="text-right p-3">تاريخ الانتهاء</th><th class="text-right p-3">الحالة</th><th class="p-3">إجراءات</th></tr></thead><tbody></tbody></table></div></div>`;

  const draw=()=>{const q=($('#ph_search').value||'').trim();const f=$('#ph_filter').value;
    const rows=phases.filter(p=>(!f||p.status===f)&&(!q||(p.task_name||'').includes(q)||(p.assignee||'').includes(q)));
    $('#ph_table tbody').innerHTML=rows.length?rows.map(p=>{const o=isOverdue(p.due_date,p.status,['تم التنفيذ']);
      return `<tr class="border-t hover:bg-slate-50 ${o?'overdue-row':''}">
        <td class="p-3 font-semibold">${esc(p.task_name)} ${o?'<i class="fas fa-triangle-exclamation text-red-500 mr-1"></i>':''}</td>
        <td class="p-3">${esc(pname(p.project_id))}</td><td class="p-3">${esc(p.assignee||'—')}</td>
        <td class="p-3 ${o?'text-red-600 font-bold':''}">${fmtDate(p.due_date)}</td><td class="p-3">${badge(p.status)}</td>
        <td class="p-3 text-center whitespace-nowrap">${can.edit()?`<button onclick="phaseForm('${p.id}')" class="text-sky-600 hover:bg-sky-50 px-2 py-1 rounded"><i class="fas fa-pen"></i></button>`:''}
        ${can.del()?`<button onclick="delItem('phases','${p.id}',renderPhases)" class="text-red-600 hover:bg-red-50 px-2 py-1 rounded"><i class="fas fa-trash"></i></button>`:''}</td></tr>`;}).join(''):`<tr><td colspan="6" class="p-8 text-center text-slate-400">لا توجد بيانات</td></tr>`;};
  $('#ph_search').addEventListener('input',draw);$('#ph_filter').addEventListener('change',draw);draw();
}

async function phaseForm(id,fixedProject){
  if(!State.cache.projects){State.cache.projects=(await api('/projects')).data;}
  const p = id?(State.cache.phases||[]).find(x=>x.id===id):{};
  const projOpts=(State.cache.projects||[]).map(x=>({value:x.id,label:x.name}));
  openModal(id?'تعديل مرحلة':'إضافة مرحلة',`
    ${fInput('task_name','اسم المهمة',p.task_name,'text',true)}
    ${fSelect('project_id','المشروع الرئيسي',projOpts,p.project_id||fixedProject||'')}
    <div class="grid grid-cols-2 gap-4">${fInput('assignee','المسؤول',p.assignee)}${fInput('due_date','تاريخ الانتهاء',p.due_date,'date')}</div>
    ${fSelect('status','الحالة',PHASE_STATUS,p.status||PHASE_STATUS[0])}
  `, async(fd)=>{const body=Object.fromEntries(fd);if(!body.due_date)body.due_date=null;
    if(id)await api('/phases/'+id,{method:'PUT',body});else await api('/phases',{method:'POST',body});
    toast('تم الحفظ'); if(fixedProject&&$('#modal')){closeModal();projectDetail(fixedProject);} if(State.route==='phases')renderPhases(); if(State.route==='projects')renderProjects();});
}

/* ===================== المدفوعات ===================== */
async function renderPayments(){
  $('#pageTitle').textContent='المدفوعات';
  $('#quickActions').innerHTML = can.create()?quickBtn('إضافة دفعة','plus','paymentForm()'):'';
  const {data}=await api('/payments'); State.cache.payments=data;
  $('#pageContent').innerHTML = searchBar('pa','بحث بالاسم أو رقم الفاتورة...',PAYMENT_STATUS)+
  `<div class="bg-white rounded-2xl shadow-sm overflow-hidden"><div class="overflow-x-auto"><table class="w-full text-sm" id="pa_table">
    <thead class="bg-slate-50 text-slate-600"><tr><th class="text-right p-3">الاسم</th><th class="text-right p-3">النوع</th>
    <th class="text-right p-3">المطلوب</th><th class="text-right p-3">المدفوع</th><th class="text-right p-3">المتبقي</th>
    <th class="text-right p-3">الحالة</th><th class="text-right p-3">الفاتورة</th><th class="p-3">إجراءات</th></tr></thead><tbody></tbody></table></div></div>`;
  const draw=()=>{const q=($('#pa_search').value||'').trim();const f=$('#pa_filter').value;
    const rows=data.filter(p=>(!f||p.status===f)&&(!q||(p.name||'').includes(q)||(p.invoice_number||'').includes(q)));
    $('#pa_table tbody').innerHTML=rows.length?rows.map(p=>{const late=p.status==='متأخر عن السداد';
      return `<tr class="border-t hover:bg-slate-50 ${late?'overdue-row':''}">
        <td class="p-3 font-semibold">${esc(p.name)} ${late?'<i class="fas fa-triangle-exclamation text-red-500 mr-1"></i>':''}</td>
        <td class="p-3">${esc(p.type)}</td><td class="p-3">${fmtSAR(p.amount_due)}</td><td class="p-3 text-emerald-600">${fmtSAR(p.amount_paid)}</td>
        <td class="p-3 font-bold ${Number(p.amount_remaining)>0?'text-amber-600':'text-slate-400'}">${fmtSAR(p.amount_remaining)}</td>
        <td class="p-3">${badge(p.status)}</td><td class="p-3 text-slate-500">${esc(p.invoice_number||'—')}</td>
        <td class="p-3 text-center whitespace-nowrap">${can.edit()?`<button onclick="paymentForm('${p.id}')" class="text-sky-600 hover:bg-sky-50 px-2 py-1 rounded"><i class="fas fa-pen"></i></button>`:''}
        ${can.del()?`<button onclick="delItem('payments','${p.id}',renderPayments)" class="text-red-600 hover:bg-red-50 px-2 py-1 rounded"><i class="fas fa-trash"></i></button>`:''}</td></tr>`;}).join(''):`<tr><td colspan="8" class="p-8 text-center text-slate-400">لا توجد بيانات</td></tr>`;};
  $('#pa_search').addEventListener('input',draw);$('#pa_filter').addEventListener('change',draw);draw();
}

async function paymentForm(id){
  if(!State.cache.clients)State.cache.clients=(await api('/clients')).data;
  if(!State.cache.projects)State.cache.projects=(await api('/projects')).data;
  const p=id?(State.cache.payments||[]).find(x=>x.id===id):{};
  const cOpts=[{value:'',label:'— بدون —'},...(State.cache.clients||[]).map(c=>({value:c.id,label:c.name}))];
  const pOpts=[{value:'',label:'— بدون —'},...(State.cache.projects||[]).map(c=>({value:c.id,label:c.name}))];
  openModal(id?'تعديل دفعة':'إضافة دفعة',`
    ${fInput('name','الاسم',p.name,'text',true)}
    <div class="grid grid-cols-2 gap-4">${fSelect('client_id','العميل',cOpts,p.client_id||'')}${fSelect('project_id','المشروع التابع',pOpts,p.project_id||'')}</div>
    <div class="grid grid-cols-2 gap-4">${fInput('amount_due','المبلغ المطلوب',p.amount_due||0,'number')}${fInput('amount_paid','المبلغ المدفوع',p.amount_paid||0,'number')}</div>
    <div class="grid grid-cols-2 gap-4">${fSelect('type','النوع',PAYMENT_TYPE,p.type||PAYMENT_TYPE[0])}${fSelect('status','حالة الدفع',PAYMENT_STATUS,p.status||PAYMENT_STATUS[0])}</div>
    <div class="grid grid-cols-3 gap-4">${fInput('invoice_number','رقم الفاتورة',p.invoice_number)}${fInput('sent_date','تاريخ الإرسال',p.sent_date,'date')}${fInput('paid_date','تاريخ الدفع',p.paid_date,'date')}</div>
  `, async(fd)=>{const body=Object.fromEntries(fd);body.amount_due=Number(body.amount_due)||0;body.amount_paid=Number(body.amount_paid)||0;
    ['client_id','project_id','sent_date','paid_date'].forEach(k=>{if(!body[k])body[k]=null;});
    if(id)await api('/payments/'+id,{method:'PUT',body});else await api('/payments',{method:'POST',body});
    toast('تم الحفظ');renderPayments();});
}

/* ===================== التقارير ===================== */
async function renderReports(){
  $('#pageTitle').textContent='التقارير';
  $('#quickActions').innerHTML = can.create()?quickBtn('إضافة تقرير','plus','reportForm()'):'';
  const [{data},{data:projects}]=await Promise.all([api('/reports'),api('/projects')]);
  State.cache.reports=data;State.cache.projects=projects;
  const pname=(pid)=>{const p=projects.find(x=>x.id===pid);return p?p.name:'—';};
  $('#pageContent').innerHTML=searchBar('rp','بحث باسم التقرير...',REPORT_STATUS)+
  `<div class="bg-white rounded-2xl shadow-sm overflow-hidden"><div class="overflow-x-auto"><table class="w-full text-sm" id="rp_table">
    <thead class="bg-slate-50 text-slate-600"><tr><th class="text-right p-3">الاسم</th><th class="text-right p-3">المشروع</th>
    <th class="text-right p-3">الحالة</th><th class="text-right p-3">تاريخ الإرسال</th><th class="p-3">إجراءات</th></tr></thead><tbody></tbody></table></div></div>`;
  const draw=()=>{const q=($('#rp_search').value||'').trim();const f=$('#rp_filter').value;
    const rows=data.filter(p=>(!f||p.status===f)&&(!q||(p.name||'').includes(q)));
    $('#rp_table tbody').innerHTML=rows.length?rows.map(p=>`<tr class="border-t hover:bg-slate-50">
      <td class="p-3 font-semibold">${esc(p.name)}</td><td class="p-3">${esc(pname(p.project_id))}</td>
      <td class="p-3">${badge(p.status)}</td><td class="p-3 text-slate-500">${fmtDate(p.sent_date)}</td>
      <td class="p-3 text-center whitespace-nowrap">${can.edit()?`<button onclick="reportForm('${p.id}')" class="text-sky-600 hover:bg-sky-50 px-2 py-1 rounded"><i class="fas fa-pen"></i></button>`:''}
      ${can.del()?`<button onclick="delItem('reports','${p.id}',renderReports)" class="text-red-600 hover:bg-red-50 px-2 py-1 rounded"><i class="fas fa-trash"></i></button>`:''}</td></tr>`).join(''):`<tr><td colspan="5" class="p-8 text-center text-slate-400">لا توجد بيانات</td></tr>`;};
  $('#rp_search').addEventListener('input',draw);$('#rp_filter').addEventListener('change',draw);draw();
}

async function reportForm(id){
  if(!State.cache.projects)State.cache.projects=(await api('/projects')).data;
  const p=id?(State.cache.reports||[]).find(x=>x.id===id):{};
  const pOpts=[{value:'',label:'— بدون —'},...(State.cache.projects||[]).map(c=>({value:c.id,label:c.name}))];
  openModal(id?'تعديل تقرير':'إضافة تقرير',`
    ${fInput('name','اسم التقرير',p.name,'text',true)}
    ${fSelect('project_id','المشروع التابع',pOpts,p.project_id||'')}
    <div class="grid grid-cols-2 gap-4">${fSelect('status','حالة التقرير',REPORT_STATUS,p.status||REPORT_STATUS[0])}${fInput('sent_date','تاريخ الإرسال',p.sent_date,'date')}</div>
  `, async(fd)=>{const body=Object.fromEntries(fd);if(!body.project_id)body.project_id=null;if(!body.sent_date)body.sent_date=null;
    if(id)await api('/reports/'+id,{method:'PUT',body});else await api('/reports',{method:'POST',body});
    toast('تم الحفظ');renderReports();});
}

/* ===================== المستخدمون (للمدير) ===================== */
async function renderUsers(){
  $('#pageTitle').textContent='المستخدمون';
  $('#quickActions').innerHTML = quickBtn('إضافة مستخدم','user-plus','userForm()');
  const {data}=await api('/users');
  $('#pageContent').innerHTML=`<div class="bg-white rounded-2xl shadow-sm overflow-hidden"><table class="w-full text-sm">
    <thead class="bg-slate-50 text-slate-600"><tr><th class="text-right p-3">الاسم</th><th class="text-right p-3">البريد</th><th class="text-right p-3">الدور</th><th class="text-right p-3">التسجيل</th></tr></thead>
    <tbody>${data.map(u=>`<tr class="border-t"><td class="p-3 font-semibold">${esc(u.full_name||'—')}</td><td class="p-3 text-slate-500">${esc(u.email||'—')}</td>
      <td class="p-3"><select onchange="changeRole('${u.id}',this.value)" class="border rounded-lg px-2 py-1 bg-white text-xs">${USER_ROLES.map(r=>`<option ${r===u.role?'selected':''}>${r}</option>`).join('')}</select></td>
      <td class="p-3 text-slate-400">${fmtDate(u.created_at)}</td></tr>`).join('')}</tbody></table></div>`;
}
async function changeRole(id,role){try{await api(`/users/${id}/role`,{method:'PUT',body:{role}});toast('تم تحديث الدور');}catch(e){toast(e.message,'error');}}
function userForm(){
  openModal('إضافة مستخدم',`${fInput('full_name','الاسم الكامل','','text',true)}${fInput('email','البريد الإلكتروني','','email',true)}
    ${fInput('password','كلمة المرور','','password',true)}${fSelect('role','الدور',USER_ROLES,'مدخل بيانات')}`,
    async(fd)=>{await api('/auth/register',{method:'POST',body:Object.fromEntries(fd)});toast('تم إنشاء المستخدم');renderUsers();});
}
