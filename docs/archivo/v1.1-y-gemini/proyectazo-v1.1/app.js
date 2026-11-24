/**
 * Proyectazo v1.1 — Core MVP
 * Offline-first · localStorage · TDAH-friendly
 */

const STORAGE_KEY = 'proyectazo_v1_1';
const COLORS = ['#3b82f6','#059669','#d97706','#8b5cf6','#ec4899','#14b8a6','#f43f5e','#6366f1'];
const EMOJIS = ['⚡','🚀','🎯','💡','🔥','🧠','📌','🛠️','📚','🎨','💼','🌱'];

// ========== STATE ==========
let state = loadState();
let view = 'dashboard'; // dashboard | project | checkout | newProject | editProject | radar
let currentProjectId = null;
let checkoutMode = 'close'; // close | advance

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return { projects: [], settings: { name: 'Usuario' } };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function daysSince(dateStr) {
  if (!dateStr) return 999;
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function freshnessClass(project) {
  if (project.nextActionType === 'esperar') return 'sem-gray';
  if (project.nextActionType === 'explorar') return 'sem-blue';
  if (project.nextActionType === 'decidir') return 'sem-yellow';
  const d = daysSince(project.lastActivity);
  if (d < 3) return 'sem-green';
  if (d < 7) return 'sem-yellow';
  return 'sem-red';
}

function freshnessLabel(project) {
  if (project.nextActionType === 'esperar') return 'Esperando';
  const d = daysSince(project.lastActivity);
  if (d === 0) return 'Hoy';
  if (d === 1) return 'Ayer';
  if (d < 999) return `Hace ${d} días`;
  return 'Sin actividad';
}

function activeProjects() {
  return state.projects.filter(p => p.status === 'activo');
}

function getProject(id) {
  return state.projects.find(p => p.id === id);
}

// ========== RENDER ==========
const app = document.getElementById('app');

function render() {
  if (view === 'dashboard') renderDashboard();
  else if (view === 'project') renderProject();
  else if (view === 'checkout') renderCheckout();
  else if (view === 'newProject') renderNewProject();
  else if (view === 'editProject') renderEditProject();
  else if (view === 'radar') renderRadar();
  else if (view === 'bitacora') renderBitacora();
}

function renderDashboard() {
  const projects = activeProjects().sort((a, b) => {
    const da = daysSince(a.lastActivity);
    const db = daysSince(b.lastActivity);
    return da - db;
  });

  const suggestion = projects.length
    ? projects.reduce((best, p) => daysSince(p.lastActivity) > daysSince(best.lastActivity) ? p : best, projects[0])
    : null;

  app.innerHTML = `
    <header class="px-4 pt-5 pb-3 flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold tracking-tight">Proyectazo</h1>
        <p class="text-xs text-slate-400">v1.1 · ¿Qué hago hoy?</p>
      </div>
      <div class="flex gap-2">
        <button onclick="goRadar()" class="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-sm">📡</button>
        <button onclick="goNewProject()" class="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center text-lg font-bold">+</button>
      </div>
    </header>

    ${suggestion ? `
    <div class="mx-4 mb-4 p-4 rounded-2xl bg-gradient-to-br from-blue-600/20 to-slate-800 border border-blue-500/30 card-enter">
      <p class="text-xs text-blue-300 mb-1">Sugerencia del día</p>
      <p class="font-semibold text-sm">${suggestion.emoji} ${suggestion.name}</p>
      <p class="text-xs text-slate-300 mt-1 truncate">${suggestion.nextAction || 'Sin próximo paso'}</p>
      <button onclick="openProject('${suggestion.id}')" class="mt-3 w-full py-2 rounded-xl bg-blue-600 text-sm font-medium active:scale-[0.98] transition">
        ▶ Continuar
      </button>
    </div>
    ` : `
    <div class="mx-4 mb-4 p-6 rounded-2xl bg-slate-900 border border-slate-800 text-center">
      <p class="text-3xl mb-2">⚡</p>
      <p class="text-sm text-slate-300">No tienes proyectos activos</p>
      <button onclick="goNewProject()" class="mt-3 px-4 py-2 rounded-xl bg-blue-600 text-sm font-medium">Crear primer proyecto</button>
    </div>
    `}

    <div class="px-4 flex-1 overflow-y-auto pb-6">
      <p class="text-xs text-slate-500 uppercase tracking-wider mb-2">Proyectos activos · ${projects.length}</p>
      ${projects.length === 0 ? '<p class="text-sm text-slate-500 text-center py-8">Crea un proyecto para empezar</p>' : ''}
      <div class="space-y-3">
        ${projects.map(p => `
          <div class="p-4 rounded-2xl bg-slate-900 border border-slate-800 card-enter active:scale-[0.99] transition" onclick="openProject('${p.id}')">
            <div class="flex items-start gap-3">
              <div class="w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0" style="background:${p.color}22;color:${p.color}">
                ${p.emoji}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full ${freshnessClass(p)} shrink-0"></span>
                  <h3 class="font-semibold text-sm truncate">${p.name}</h3>
                </div>
                <p class="text-xs text-slate-400 mt-0.5">${freshnessLabel(p)}</p>
                <p class="text-sm text-slate-200 mt-2 line-clamp-2">${p.nextAction || '<span class="text-slate-500 italic">Sin próximo paso</span>'}</p>
                ${p.nextActionType && p.nextActionType !== 'hacer' ? `<span class="inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">${p.nextActionType}</span>` : ''}
              </div>
            </div>
            <div class="flex gap-2 mt-3">
              <button onclick="event.stopPropagation(); startCheckout('${p.id}','advance')" class="flex-1 py-2 rounded-xl bg-slate-800 text-xs font-medium active:bg-slate-700">+ Avance</button>
              <button onclick="event.stopPropagation(); openProject('${p.id}')" class="flex-1 py-2 rounded-xl bg-blue-600/80 text-xs font-medium active:bg-blue-600">Abrir</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderProject() {
  const p = getProject(currentProjectId);
  if (!p) { view = 'dashboard'; render(); return; }

  const logs = (p.logs || []).slice().reverse().slice(0, 8);

  app.innerHTML = `
    <header class="px-4 pt-5 pb-3 flex items-center gap-3">
      <button onclick="goDashboard()" class="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-sm">←</button>
      <div class="flex-1 min-w-0">
        <h1 class="font-bold text-base truncate">${p.emoji} ${p.name}</h1>
        <p class="text-xs text-slate-400">${freshnessLabel(p)} · ${p.status}</p>
      </div>
      <button onclick="goEditProject()" class="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-sm">⚙️</button>
    </header>

    <div class="px-4 flex-1 overflow-y-auto pb-24">
      <!-- Next Action Card -->
      <div class="p-4 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 mb-4">
        <p class="text-xs text-slate-400 mb-1">Próximo paso</p>
        <p class="font-medium text-base">${p.nextAction || '<span class="text-slate-500 italic">No definido</span>'}</p>
        ${p.nextActionType ? `<span class="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">${p.nextActionType}</span>` : ''}
      </div>

      ${p.objective ? `
      <div class="mb-4">
        <p class="text-xs text-slate-500 mb-1">Objetivo</p>
        <p class="text-sm text-slate-300">${p.objective}</p>
      </div>
      ` : ''}

      ${p.context ? `
      <div class="mb-4 p-3 rounded-xl bg-slate-900 border border-slate-800">
        <p class="text-xs text-slate-500 mb-1">Contexto</p>
        <p class="text-sm text-slate-300 whitespace-pre-wrap">${p.context}</p>
      </div>
      ` : ''}

      <!-- Mini Kanban -->
      <p class="text-xs text-slate-500 uppercase tracking-wider mb-2">Kanban · En foco (máx 3)</p>
      <div class="flex gap-2 overflow-x-auto pb-2 mb-4">
        ${['ideas','siguiente','enfoco','hecho'].map(col => {
          const tasks = (p.tasks || []).filter(t => t.column === col);
          const labels = { ideas: 'Ideas', siguiente: 'Siguiente', enfoco: 'En foco', hecho: 'Hecho' };
          return `
            <div class="min-w-[140px] flex-1 bg-slate-900 rounded-xl p-2 border border-slate-800">
              <p class="text-[10px] text-slate-500 mb-1.5 font-medium">${labels[col]} · ${tasks.length}</p>
              ${tasks.map(t => `
                <div class="p-2 mb-1.5 rounded-lg bg-slate-800 text-xs cursor-pointer" onclick="cycleTask('${p.id}','${t.id}')">
                  ${t.title}
                </div>
              `).join('') || '<p class="text-[10px] text-slate-600 py-2">Vacío</p>'}
              ${col !== 'hecho' ? `<button onclick="addTask('${p.id}','${col}')" class="w-full text-[10px] text-slate-500 py-1">+ agregar</button>` : ''}
            </div>
          `;
        }).join('')}
      </div>

      <!-- Bitácora preview -->
      <div class="flex items-center justify-between mb-2">
        <p class="text-xs text-slate-500 uppercase tracking-wider">Bitácora</p>
        <button onclick="goBitacora()" class="text-xs text-blue-400">Ver todo →</button>
      </div>
      <div class="space-y-2">
        ${logs.length === 0 ? '<p class="text-sm text-slate-600 py-4 text-center">Sin avances aún</p>' : ''}
        ${logs.map(l => `
          <div class="p-3 rounded-xl bg-slate-900 border border-slate-800">
            <p class="text-[10px] text-slate-500">${formatDate(l.date)}</p>
            <p class="text-sm mt-0.5">${l.achievement}</p>
            ${l.nextStep ? `<p class="text-xs text-blue-300 mt-1">→ ${l.nextStep}</p>` : ''}
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Bottom actions -->
    <div class="fixed bottom-0 left-0 right-0 max-w-lg mx-auto p-4 bg-slate-950/95 backdrop-blur border-t border-slate-800 flex gap-2">
      <button onclick="startCheckout('${p.id}','advance')" class="flex-1 py-3 rounded-xl bg-slate-800 font-medium text-sm active:scale-[0.98]">
        + Registrar avance
      </button>
      <button onclick="startCheckout('${p.id}','close')" class="flex-1 py-3 rounded-xl bg-blue-600 font-medium text-sm active:scale-[0.98]">
        Cerrar sesión
      </button>
    </div>
  `;
}

function renderCheckout() {
  const p = getProject(currentProjectId);
  if (!p) { view = 'dashboard'; render(); return; }

  app.innerHTML = `
    <header class="px-4 pt-5 pb-3">
      <h1 class="font-bold text-lg">${checkoutMode === 'close' ? 'Cerrar sesión' : 'Registrar avance'}</h1>
      <p class="text-xs text-slate-400">${p.emoji} ${p.name}</p>
    </header>

    <div class="px-4 flex-1 overflow-y-auto pb-6">
      <div class="mb-4">
        <label class="text-xs text-slate-400 block mb-1.5">¿Qué avanzaste? *</label>
        <textarea id="achievement" rows="3" placeholder="Ej: Definí el esquema de la base de datos..."
          class="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-sm focus:outline-none focus:border-blue-500 resize-none"></textarea>
      </div>

      <div class="mb-4">
        <label class="text-xs text-slate-400 block mb-1.5">¿Cuál es el próximo paso concreto? *</label>
        <input id="nextStep" type="text" placeholder="Ej: Crear la tabla de usuarios"
          value="${p.nextAction || ''}"
          class="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-sm focus:outline-none focus:border-blue-500" />
      </div>

      <div class="mb-4">
        <label class="text-xs text-slate-400 block mb-1.5">Tipo de próximo paso</label>
        <div class="grid grid-cols-4 gap-2">
          ${['hacer','esperar','decidir','explorar'].map(t => `
            <button type="button" onclick="selectType('${t}')" data-type="${t}"
              class="type-btn py-2 rounded-xl text-xs border border-slate-700 ${t==='hacer'?'bg-blue-600 border-blue-500':'bg-slate-900'}">
              ${t}
            </button>
          `).join('')}
        </div>
      </div>

      <div class="mb-4">
        <label class="text-xs text-slate-400 block mb-1.5">Contexto / notas (opcional)</label>
        <textarea id="contextNote" rows="2" placeholder="Qué pensabas, qué falta decidir..."
          class="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-sm focus:outline-none focus:border-blue-500 resize-none">${p.context || ''}</textarea>
      </div>

      ${checkoutMode === 'close' ? `
      <div class="mb-4">
        <label class="text-xs text-slate-400 block mb-1.5">Estado del proyecto</label>
        <div class="grid grid-cols-3 gap-2">
          ${['activo','pausado','esperando'].map(s => `
            <button type="button" onclick="selectStatus('${s}')" data-status="${s}"
              class="status-btn py-2 rounded-xl text-xs border border-slate-700 ${s===p.status?'bg-blue-600 border-blue-500':'bg-slate-900'}">
              ${s}
            </button>
          `).join('')}
        </div>
      </div>
      ` : ''}
    </div>

    <div class="p-4 border-t border-slate-800 flex gap-2">
      <button onclick="cancelCheckout()" class="flex-1 py-3 rounded-xl bg-slate-800 text-sm font-medium">Cancelar</button>
      <button onclick="saveCheckout()" class="flex-1 py-3 rounded-xl bg-blue-600 text-sm font-medium">Guardar</button>
    </div>
  `;

  window._selectedType = p.nextActionType || 'hacer';
  window._selectedStatus = p.status;
}

function renderNewProject() {
  app.innerHTML = `
    <header class="px-4 pt-5 pb-3 flex items-center gap-3">
      <button onclick="goDashboard()" class="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-sm">←</button>
      <h1 class="font-bold text-lg">Nuevo proyecto</h1>
    </header>

    <div class="px-4 flex-1 overflow-y-auto pb-6">
      <div class="mb-4">
        <label class="text-xs text-slate-400 block mb-1.5">Nombre *</label>
        <input id="pName" type="text" placeholder="Ej: App de finanzas"
          class="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-sm focus:outline-none focus:border-blue-500" />
      </div>

      <div class="mb-4">
        <label class="text-xs text-slate-400 block mb-1.5">Emoji</label>
        <div class="flex flex-wrap gap-2">
          ${EMOJIS.map(e => `<button type="button" onclick="selectEmoji('${e}')" class="emoji-btn w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 text-lg ${e===EMOJIS[0]?'border-blue-500':''}">${e}</button>`).join('')}
        </div>
      </div>

      <div class="mb-4">
        <label class="text-xs text-slate-400 block mb-1.5">Color</label>
        <div class="flex flex-wrap gap-2">
          ${COLORS.map(c => `<button type="button" onclick="selectColor('${c}')" class="color-btn w-8 h-8 rounded-full border-2 ${c===COLORS[0]?'border-white':'border-transparent'}" style="background:${c}"></button>`).join('')}
        </div>
      </div>

      <div class="mb-4">
        <label class="text-xs text-slate-400 block mb-1.5">Objetivo (opcional)</label>
        <input id="pObjective" type="text" placeholder="¿Qué quieres lograr?"
          class="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-sm focus:outline-none focus:border-blue-500" />
      </div>

      <div class="mb-4">
        <label class="text-xs text-slate-400 block mb-1.5">Primer próximo paso *</label>
        <input id="pNext" type="text" placeholder="La acción más pequeña para empezar"
          class="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-sm focus:outline-none focus:border-blue-500" />
      </div>
    </div>

    <div class="p-4 border-t border-slate-800">
      <button onclick="createProject()" class="w-full py-3 rounded-xl bg-blue-600 text-sm font-medium">Crear proyecto</button>
    </div>
  `;
  window._selectedEmoji = EMOJIS[0];
  window._selectedColor = COLORS[0];
}

function renderEditProject() {
  const p = getProject(currentProjectId);
  if (!p) { view = 'dashboard'; render(); return; }

  app.innerHTML = `
    <header class="px-4 pt-5 pb-3 flex items-center gap-3">
      <button onclick="openProject('${p.id}')" class="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-sm">←</button>
      <h1 class="font-bold text-lg">Editar proyecto</h1>
    </header>

    <div class="px-4 flex-1 overflow-y-auto pb-6">
      <div class="mb-4">
        <label class="text-xs text-slate-400 block mb-1.5">Nombre</label>
        <input id="eName" type="text" value="${p.name}"
          class="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-sm focus:outline-none focus:border-blue-500" />
      </div>
      <div class="mb-4">
        <label class="text-xs text-slate-400 block mb-1.5">Objetivo</label>
        <input id="eObjective" type="text" value="${p.objective || ''}"
          class="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-sm focus:outline-none focus:border-blue-500" />
      </div>
      <div class="mb-4">
        <label class="text-xs text-slate-400 block mb-1.5">Estado</label>
        <div class="grid grid-cols-3 gap-2">
          ${['activo','pausado','esperando','idea','completado'].map(s => `
            <button type="button" onclick="selectEditStatus('${s}')" data-estatus="${s}"
              class="estatus-btn py-2 rounded-xl text-xs border border-slate-700 ${s===p.status?'bg-blue-600 border-blue-500':'bg-slate-900'}">
              ${s}
            </button>
          `).join('')}
        </div>
      </div>
      <div class="mb-4">
        <label class="text-xs text-slate-400 block mb-1.5">Contexto</label>
        <textarea id="eContext" rows="3"
          class="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-sm focus:outline-none focus:border-blue-500 resize-none">${p.context || ''}</textarea>
      </div>
    </div>

    <div class="p-4 border-t border-slate-800 space-y-2">
      <button onclick="saveEdit()" class="w-full py-3 rounded-xl bg-blue-600 text-sm font-medium">Guardar</button>
      <button onclick="deleteProject()" class="w-full py-3 rounded-xl bg-red-900/50 text-red-300 text-sm font-medium">Eliminar proyecto</button>
    </div>
  `;
  window._editStatus = p.status;
}

function renderRadar() {
  const all = state.projects;
  const groups = {
    activo: all.filter(p => p.status === 'activo'),
    pausado: all.filter(p => p.status === 'pausado'),
    esperando: all.filter(p => p.status === 'esperando'),
    idea: all.filter(p => p.status === 'idea'),
    completado: all.filter(p => p.status === 'completado'),
  };

  app.innerHTML = `
    <header class="px-4 pt-5 pb-3 flex items-center gap-3">
      <button onclick="goDashboard()" class="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-sm">←</button>
      <h1 class="font-bold text-lg">Radar de proyectos</h1>
    </header>

    <div class="px-4 flex-1 overflow-y-auto pb-6 space-y-4">
      ${Object.entries(groups).map(([status, list]) => list.length === 0 ? '' : `
        <div>
          <p class="text-xs text-slate-500 uppercase tracking-wider mb-2">${status} · ${list.length}</p>
          <div class="space-y-2">
            ${list.map(p => `
              <div class="p-3 rounded-xl bg-slate-900 border border-slate-800 flex items-center gap-3 cursor-pointer" onclick="openProject('${p.id}')">
                <span class="w-2 h-2 rounded-full ${freshnessClass(p)}"></span>
                <span class="text-lg">${p.emoji}</span>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium truncate">${p.name}</p>
                  <p class="text-xs text-slate-400 truncate">${p.nextAction || '—'}</p>
                </div>
                <span class="text-[10px] text-slate-500">${freshnessLabel(p)}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `).join('')}
      ${all.length === 0 ? '<p class="text-center text-slate-500 py-12">Sin proyectos</p>' : ''}
    </div>
  `;
}

function renderBitacora() {
  const p = getProject(currentProjectId);
  if (!p) { view = 'dashboard'; render(); return; }
  const logs = (p.logs || []).slice().reverse();

  app.innerHTML = `
    <header class="px-4 pt-5 pb-3 flex items-center gap-3">
      <button onclick="openProject('${p.id}')" class="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-sm">←</button>
      <h1 class="font-bold text-lg">Bitácora · ${p.name}</h1>
    </header>

    <div class="px-4 flex-1 overflow-y-auto pb-6 space-y-3">
      ${logs.length === 0 ? '<p class="text-center text-slate-500 py-12">Sin entradas aún</p>' : ''}
      ${logs.map(l => `
        <div class="p-4 rounded-2xl bg-slate-900 border border-slate-800 card-enter">
          <p class="text-xs text-slate-500 mb-1">${formatDate(l.date)}</p>
          <p class="text-sm font-medium">${l.achievement}</p>
          ${l.nextStep ? `<p class="text-xs text-blue-300 mt-2">→ ${l.nextStep}</p>` : ''}
          ${l.contextNote ? `<p class="text-xs text-slate-400 mt-1 italic">${l.contextNote}</p>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

function formatDate(iso) {
  const d = new Date(iso);
  const now = new Date();
  const diff = Math.floor((now - d) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Hoy · ' + d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  if (diff === 1) return 'Ayer · ' + d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ========== ACTIONS ==========
function goDashboard() { view = 'dashboard'; currentProjectId = null; render(); }
function goNewProject() { view = 'newProject'; render(); }
function goRadar() { view = 'radar'; render(); }
function goEditProject() { view = 'editProject'; render(); }
function goBitacora() { view = 'bitacora'; render(); }

function openProject(id) {
  currentProjectId = id;
  view = 'project';
  render();
}

function startCheckout(id, mode) {
  currentProjectId = id;
  checkoutMode = mode;
  view = 'checkout';
  render();
}

function cancelCheckout() {
  view = 'project';
  render();
}

function selectType(t) {
  window._selectedType = t;
  document.querySelectorAll('.type-btn').forEach(b => {
    b.classList.toggle('bg-blue-600', b.dataset.type === t);
    b.classList.toggle('border-blue-500', b.dataset.type === t);
    b.classList.toggle('bg-slate-900', b.dataset.type !== t);
  });
}

function selectStatus(s) {
  window._selectedStatus = s;
  document.querySelectorAll('.status-btn').forEach(b => {
    b.classList.toggle('bg-blue-600', b.dataset.status === s);
    b.classList.toggle('border-blue-500', b.dataset.status === s);
    b.classList.toggle('bg-slate-900', b.dataset.status !== s);
  });
}

function selectEditStatus(s) {
  window._editStatus = s;
  document.querySelectorAll('.estatus-btn').forEach(b => {
    b.classList.toggle('bg-blue-600', b.dataset.estatus === s);
    b.classList.toggle('border-blue-500', b.dataset.estatus === s);
    b.classList.toggle('bg-slate-900', b.dataset.estatus !== s);
  });
}

function selectEmoji(e) {
  window._selectedEmoji = e;
  document.querySelectorAll('.emoji-btn').forEach(b => {
    b.classList.toggle('border-blue-500', b.textContent === e);
  });
}

function selectColor(c) {
  window._selectedColor = c;
  document.querySelectorAll('.color-btn').forEach(b => {
    b.classList.toggle('border-white', b.style.background === c || b.style.backgroundColor === c);
  });
}

function saveCheckout() {
  const achievement = document.getElementById('achievement').value.trim();
  const nextStep = document.getElementById('nextStep').value.trim();
  const contextNote = document.getElementById('contextNote').value.trim();

  if (!achievement) { alert('Escribe qué avanzaste'); return; }
  if (!nextStep) { alert('Define el próximo paso (obligatorio)'); return; }

  const p = getProject(currentProjectId);
  if (!p) return;

  if (!p.logs) p.logs = [];
  p.logs.push({
    id: uid(),
    date: new Date().toISOString(),
    achievement,
    nextStep,
    contextNote: contextNote || null,
    type: window._selectedType
  });

  p.nextAction = nextStep;
  p.nextActionType = window._selectedType || 'hacer';
  p.lastActivity = new Date().toISOString();
  if (contextNote) p.context = contextNote;
  if (checkoutMode === 'close' && window._selectedStatus) {
    p.status = window._selectedStatus;
  }

  saveState();
  view = p.status === 'activo' ? 'project' : 'dashboard';
  render();
}

function createProject() {
  const name = document.getElementById('pName').value.trim();
  const next = document.getElementById('pNext').value.trim();
  const objective = document.getElementById('pObjective').value.trim();

  if (!name) { alert('Ponle un nombre'); return; }
  if (!next) { alert('Define el primer próximo paso'); return; }

  const project = {
    id: uid(),
    name,
    emoji: window._selectedEmoji || '⚡',
    color: window._selectedColor || '#3b82f6',
    objective: objective || '',
    status: 'activo',
    nextAction: next,
    nextActionType: 'hacer',
    context: '',
    lastActivity: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    tasks: [],
    logs: [{
      id: uid(),
      date: new Date().toISOString(),
      achievement: 'Proyecto creado',
      nextStep: next,
      contextNote: null,
      type: 'hacer'
    }]
  };

  state.projects.push(project);
  saveState();
  currentProjectId = project.id;
  view = 'project';
  render();
}

function saveEdit() {
  const p = getProject(currentProjectId);
  if (!p) return;
  p.name = document.getElementById('eName').value.trim() || p.name;
  p.objective = document.getElementById('eObjective').value.trim();
  p.context = document.getElementById('eContext').value.trim();
  p.status = window._editStatus || p.status;
  saveState();
  view = 'project';
  render();
}

function deleteProject() {
  if (!confirm('¿Eliminar este proyecto y todo su historial?')) return;
  state.projects = state.projects.filter(p => p.id !== currentProjectId);
  saveState();
  goDashboard();
}

function addTask(projectId, column) {
  const title = prompt('Título de la tarea:');
  if (!title || !title.trim()) return;
  const p = getProject(projectId);
  if (!p) return;
  if (!p.tasks) p.tasks = [];

  if (column === 'enfoco') {
    const inFocus = p.tasks.filter(t => t.column === 'enfoco').length;
    if (inFocus >= 3) {
      alert('Límite WIP: máximo 3 en "En foco". Mueve o completa alguna primero.');
      return;
    }
  }

  p.tasks.push({ id: uid(), title: title.trim(), column, createdAt: new Date().toISOString() });
  saveState();
  render();
}

function cycleTask(projectId, taskId) {
  const p = getProject(projectId);
  if (!p) return;
  const t = (p.tasks || []).find(x => x.id === taskId);
  if (!t) return;
  const order = ['ideas', 'siguiente', 'enfoco', 'hecho'];
  const idx = order.indexOf(t.column);
  const next = order[(idx + 1) % order.length];

  if (next === 'enfoco') {
    const inFocus = p.tasks.filter(x => x.column === 'enfoco' && x.id !== taskId).length;
    if (inFocus >= 3) {
      alert('Límite WIP: máximo 3 en "En foco".');
      return;
    }
  }

  t.column = next;
  if (next === 'hecho') {
    p.lastActivity = new Date().toISOString();
  }
  saveState();
  render();
}

// Init
render();

// Register service worker for basic PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
