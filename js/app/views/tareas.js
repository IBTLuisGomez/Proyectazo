'use strict';
// Vista centralizada de tareas y pendientes con filtros.
// Métodos de ProyectazoApp (la clase base está en js/app.js).

defineAppMethods({

  // ==========================================
  // VISTA CENTRALIZADA: 📋 TAREAS & PENDIENTES
  // ==========================================
  renderViewTareas(container) {
    if (!this.tareasFilter) this.tareasFilter = 'all';
    if (!this.tareasProjectFilter) this.tareasProjectFilter = 'all';
    if (!this.tareasSearchQuery) this.tareasSearchQuery = '';

    const projects = this.state.projects || [];

    let allTasks = [];
    projects.forEach(p => {
      (p.tasks || []).forEach(t => {
        allTasks.push({
          ...t,
          projectId: p.id,
          projectName: p.name,
          projectEmoji: p.emoji || '📁',
          projectColor: p.color || '#10b981',
          projectStatus: p.status
        });
      });
    });

    const totalCount = allTasks.length;
    const enfocoCount = allTasks.filter(t => t.column === 'enfoco').length;
    const proximoCount = allTasks.filter(t => t.column === 'proximo').length;
    const buzonCount = allTasks.filter(t => t.column === 'buzon').length;
    const coolingCount = allTasks.filter(t => {
      const days = this.daysSince(t.createdAt);
      return (t.column === 'enfoco' || t.column === 'proximo') && days >= 7;
    }).length;
    const congeladorCount = allTasks.filter(t => t.column === 'congelador').length;
    const victoriasCount = allTasks.filter(t => t.column === 'victorias').length;

    let filtered = allTasks;

    if (this.tareasProjectFilter !== 'all') {
      filtered = filtered.filter(t => t.projectId === this.tareasProjectFilter);
    }

    if (this.tareasFilter !== 'all') {
      if (this.tareasFilter === 'cooling') {
        filtered = filtered.filter(t => {
          const days = this.daysSince(t.createdAt);
          return (t.column === 'enfoco' || t.column === 'proximo') && days >= 7;
        });
      } else {
        filtered = filtered.filter(t => t.column === this.tareasFilter);
      }
    }

    if (this.tareasSearchQuery && this.tareasSearchQuery.trim()) {
      const q = this.tareasSearchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        (t.title && t.title.toLowerCase().includes(q)) ||
        (t.notes && t.notes.toLowerCase().includes(q)) ||
        (t.projectName && t.projectName.toLowerCase().includes(q))
      );
    }

    const columnBadges = {
      enfoco: { label: '🔥 En Foco', class: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
      proximo: { label: '🎯 Próximo Paso', class: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' },
      buzon: { label: '📥 Buzón', class: 'bg-slate-700 text-slate-300 border-slate-600' },
      congelador: { label: '❄️ Congelador', class: 'bg-sky-500/20 text-sky-300 border-sky-500/40' },
      victorias: { label: '🏆 Victoria', class: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold' }
    };

    const effortBadges = {
      XS: 'bg-emerald-500/15 text-emerald-400',
      S: 'bg-teal-500/15 text-teal-300',
      M: 'bg-amber-500/15 text-amber-300',
      L: 'bg-purple-500/15 text-purple-300'
    };

    container.innerHTML = `
      <!-- Header Tareas & Pendientes -->
      <div class="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2">
            <span class="text-xs font-mono font-bold uppercase text-cyan-400 tracking-wider">Gestión Global</span>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-bold">${totalCount} Tarjetas</span>
          </div>
          <h1 class="text-2xl sm:text-3xl font-display font-extrabold mt-0.5 flex items-center gap-2.5">
            <span>📋</span> Centro de Tareas & Pendientes
          </h1>
          <p class="text-xs theme-text-muted mt-1">Visión consolidada de todas las tarjetas y tareas de tus proyectos con edición completa.</p>
        </div>

        <div class="flex items-center gap-2 self-start md:self-auto flex-wrap">
          <button onclick="app.openCreateTaskModal()" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition flex items-center gap-1.5">
            <span>➕</span> Nueva Tarea
          </button>
        </div>
      </div>

      <!-- Métricas Rápidas de Tareas -->
      <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-6">
        <button onclick="app.setTareasFilter('all')" class="p-3 rounded-2xl theme-card border ${this.tareasFilter === 'all' ? 'border-cyan-500 ring-2 ring-cyan-500/30' : 'theme-border'} text-left transition hover:brightness-105">
          <span class="text-[11px] theme-text-muted font-semibold block">Todas</span>
          <span class="text-xl font-display font-extrabold text-white mt-0.5 block">${totalCount}</span>
        </button>
        <button onclick="app.setTareasFilter('enfoco')" class="p-3 rounded-2xl theme-card border ${this.tareasFilter === 'enfoco' ? 'border-rose-500 ring-2 ring-rose-500/30' : 'theme-border'} text-left transition hover:brightness-105">
          <span class="text-[11px] text-rose-300 font-semibold block">🔥 En Foco</span>
          <span class="text-xl font-display font-extrabold text-rose-400 mt-0.5 block">${enfocoCount}</span>
        </button>
        <button onclick="app.setTareasFilter('proximo')" class="p-3 rounded-2xl theme-card border ${this.tareasFilter === 'proximo' ? 'border-cyan-500 ring-2 ring-cyan-500/30' : 'theme-border'} text-left transition hover:brightness-105">
          <span class="text-[11px] text-cyan-300 font-semibold block">🎯 Próximo</span>
          <span class="text-xl font-display font-extrabold text-cyan-400 mt-0.5 block">${proximoCount}</span>
        </button>
        <button onclick="app.setTareasFilter('buzon')" class="p-3 rounded-2xl theme-card border ${this.tareasFilter === 'buzon' ? 'border-amber-500 ring-2 ring-amber-500/30' : 'theme-border'} text-left transition hover:brightness-105">
          <span class="text-[11px] text-amber-300 font-semibold block">📥 Buzón</span>
          <span class="text-xl font-display font-extrabold text-amber-400 mt-0.5 block">${buzonCount}</span>
        </button>
        <button onclick="app.setTareasFilter('cooling')" class="p-3 rounded-2xl theme-card border ${this.tareasFilter === 'cooling' ? 'border-sky-500 ring-2 ring-sky-500/30' : 'theme-border'} text-left transition hover:brightness-105" title="Tareas estancadas por más de 7 días">
          <span class="text-[11px] text-sky-300 font-semibold block">❄️ Enfriándose</span>
          <span class="text-xl font-display font-extrabold text-sky-400 mt-0.5 block">${coolingCount}</span>
        </button>
        <button onclick="app.setTareasFilter('victorias')" class="p-3 rounded-2xl theme-card border ${this.tareasFilter === 'victorias' ? 'border-emerald-500 ring-2 ring-emerald-500/30' : 'theme-border'} text-left transition hover:brightness-105">
          <span class="text-[11px] text-emerald-300 font-semibold block">🏆 Victorias</span>
          <span class="text-xl font-display font-extrabold text-emerald-400 mt-0.5 block">${victoriasCount}</span>
        </button>
      </div>

      <!-- Barra de Filtros y Búsqueda -->
      <div class="mb-6 p-3.5 rounded-2xl theme-card border theme-border flex flex-col md:flex-row items-center justify-between gap-3 shadow-sm">
        <div class="w-full md:w-72 relative">
          <input type="text" value="${this.escapeHtml(this.tareasSearchQuery)}" 
            oninput="app.setTareasSearch(this.value)"
            placeholder="🔍 Buscar en tareas y notas..."
            class="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500" />
          <span class="absolute left-3 top-2.5 text-xs text-slate-500">🔍</span>
        </div>

        <div class="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
          <span class="text-xs font-bold text-slate-400 shrink-0">Proyecto:</span>
          <select onchange="app.setTareasProjectFilter(this.value)" class="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-semibold text-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-500">
            <option value="all" ${this.tareasProjectFilter === 'all' ? 'selected' : ''}>Todos los Proyectos (${projects.length})</option>
            ${projects.map(p => `
              <option value="${p.id}" ${this.tareasProjectFilter === p.id ? 'selected' : ''}>
                ${p.emoji || '📁'} ${this.escapeHtml(p.name)} (${(p.tasks || []).length})
              </option>
            `).join('')}
          </select>

          <button onclick="app.setTareasFilter('all'); app.setTareasProjectFilter('all'); app.setTareasSearch('');" class="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold shrink-0" title="Restablecer filtros">
            ↺ Limpiar
          </button>
        </div>
      </div>

      <!-- Listado de Tarjetas de Tareas -->
      ${filtered.length === 0 ? `
        <div class="p-12 text-center theme-card rounded-3xl border theme-border space-y-3">
          <div class="text-4xl">✨</div>
          <h4 class="text-base font-bold text-white">No hay tareas que coincidan</h4>
          <p class="text-xs theme-text-muted max-w-sm mx-auto">Ajusta los filtros o agrega una nueva tarea a cualquiera de tus proyectos.</p>
          <button onclick="app.openCreateTaskModal()" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition">
            + Crear Tarea
          </button>
        </div>
      ` : `
        <div class="space-y-2.5">
          ${filtered.map(t => {
            const colMeta = columnBadges[t.column] || columnBadges.buzon;
            const effortClass = effortBadges[t.effort] || effortBadges.M;
            const ageDays = this.daysSince(t.createdAt);
            const isCooling = (t.column === 'enfoco' || t.column === 'proximo') && ageDays >= 7;

            return `
              <div class="p-4 rounded-2xl theme-card border ${isCooling ? 'border-sky-500/40 bg-sky-950/10' : 'theme-border'} shadow-sm hover:border-cyan-500/40 transition flex flex-col md:flex-row md:items-center justify-between gap-3 group"
                style="border-left: 4px solid ${t.projectColor};">

                <div class="flex-1 min-w-0">
                  <!-- Badges y Origen -->
                  <div class="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span class="text-[10px] font-mono px-2 py-0.5 rounded-full border ${colMeta.class}">
                      ${colMeta.label}
                    </span>

                    <button onclick="app.openKanbanProject('${t.projectId}')" class="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 flex items-center gap-1 transition" title="Ir al Kanban de este proyecto">
                      <span>${t.projectEmoji}</span>
                      <span class="max-w-[120px] truncate">${this.escapeHtml(t.projectName)}</span>
                    </button>

                    <span class="text-[9px] font-mono px-1.5 py-0.5 rounded font-bold ${effortClass}">
                      ${t.effort || 'M'}
                    </span>

                    ${t.isBureaucratic ? `
                      <span class="badge-bureaucracy text-[9px] font-bold px-1.5 py-0.2 rounded-md">
                        📑 Burocrática
                      </span>
                    ` : ''}

                    ${isCooling ? `
                      <span class="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-slate-700/60 text-slate-300 border border-slate-600/50">
                        ❄️ Perdiendo inercia (${ageDays}d)
                      </span>
                    ` : ''}

                    ${t.codeSnippet ? `<span class="text-[9px] font-mono text-sky-400">💻 Código</span>` : ''}
                  </div>

                  <!-- Título y Notas -->
                  <h3 class="text-sm font-bold text-white hover:text-emerald-400 transition cursor-pointer" onclick="app.openEditTaskModal('${t.projectId}', '${t.id}')">
                    ${this.escapeHtml(t.title)}
                  </h3>

                  ${t.notes ? `<p class="text-xs text-slate-400 mt-1 line-clamp-2 font-mono">${this.escapeHtml(t.notes)}</p>` : ''}
                </div>

                <!-- Botones de Acción de Tarea -->
                <div class="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                  <button onclick="app.openEditTaskModal('${t.projectId}', '${t.id}')" class="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition active:scale-95 flex items-center gap-1" title="Editar Tarea (CRUD)">
                    <span>✏️</span> <span class="hidden sm:inline">Editar</span>
                  </button>

                  <button onclick="app.openOneThingMode('${t.projectId}', '${t.id}')" class="p-1.5 rounded-xl theme-card-subtle border theme-border theme-text-muted hover:text-purple-300 text-xs" title="Modo Solo 1 Cosa">
                    👁️
                  </button>

                  <button onclick="app.openDeepWork('${t.projectId}', '${t.id}')" class="p-1.5 rounded-xl theme-card-subtle border theme-border theme-text-muted hover:text-sky-300 text-xs" title="Notas Deep Work">
                    💻
                  </button>

                  <button onclick="app.moveTaskPrev('${t.projectId}', '${t.id}')" class="p-1.5 rounded-xl theme-card-subtle border theme-border theme-text-muted hover:text-white text-xs font-bold" title="Mover a columna anterior">
                    ←
                  </button>

                  <button onclick="app.moveTaskNext('${t.projectId}', '${t.id}')" class="p-1.5 rounded-xl theme-card-subtle border theme-border theme-text-muted hover:text-white text-xs font-bold" title="Avanzar de columna">
                    →
                  </button>

                  ${t.column !== 'victorias' ? `
                    <button onclick="${t.isBureaucratic ? `app.completeBureaucraticTask('${t.projectId}', '${t.id}')` : `app.moveTaskToColumn('${t.projectId}', '${t.id}', 'victorias')`}" class="px-2.5 py-1.5 rounded-xl bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30 text-xs font-bold transition flex items-center gap-1 active:scale-95" title="Marcar como Victoria">
                      <span>✓</span> <span class="hidden sm:inline">Victoria</span>
                    </button>
                  ` : ''}

                  <button onclick="app.deleteTask('${t.projectId}', '${t.id}')" class="p-1.5 rounded-xl theme-card-subtle border theme-border theme-text-muted hover:text-rose-400 text-xs" title="Eliminar tarea">
                    🗑️
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    `;
  },

  setTareasFilter(filter) {
    this.tareasFilter = filter;
    const container = document.getElementById('view-container');
    if (container) this.renderViewTareas(container);
  },

  setTareasProjectFilter(projId) {
    this.tareasProjectFilter = projId;
    const container = document.getElementById('view-container');
    if (container) this.renderViewTareas(container);
  },

  setTareasSearch(query) {
    this.tareasSearchQuery = query;
    const container = document.getElementById('view-container');
    if (container) this.renderViewTareas(container);
  },
});
