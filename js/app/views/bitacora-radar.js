'use strict';
// Vistas "Bitácora" y "Radar".
// Métodos de ProyectazoApp (la clase base está en js/app.js).

defineAppMethods({

  // ==========================================
  // VISTA 3: BITÁCORA / DIARIO DE AVANCES
  // ==========================================
  renderViewBitacora(container) {
    let allLogs = [];
    (this.state.projects || []).forEach(p => {
      (p.logs || []).forEach(l => {
        allLogs.push({
          ...l,
          projectId: p.id,
          projectName: p.name,
          projectEmoji: p.emoji,
          projectColor: p.color
        });
      });
    });

    allLogs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    container.innerHTML = `
      <div class="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span class="text-xs font-mono font-bold uppercase text-emerald-400 tracking-wider">Historial de Victorias</span>
          <h1 class="text-2xl sm:text-3xl font-display font-extrabold mt-0.5">
            Bitácora de Logros (${allLogs.length})
          </h1>
          <p class="text-xs theme-text-muted mt-1">La evidencia tangible de tu progreso para neutralizar el síndrome de no haber hecho nada.</p>
        </div>

        <div class="flex items-center gap-2">
          <input type="text" id="bitacora-search" oninput="app.filterBitacora(this.value)" placeholder="Buscar en historial..."
            class="px-3 py-2 rounded-xl theme-card-subtle border theme-border text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500 w-48" />
          <button onclick="app.printBitacoraReport()" class="px-3.5 py-2 rounded-xl theme-card-subtle hover:brightness-110 text-xs font-semibold border theme-border transition">
            📄 Exportar PDF
          </button>
        </div>
      </div>

      <div id="bitacora-list" class="space-y-3.5">
        ${allLogs.length === 0 ? `
          <div class="p-12 text-center rounded-3xl border border-dashed theme-border theme-text-muted">
            <span class="text-4xl block mb-2">📜</span>
            <p class="font-semibold text-sm">Aún no hay avances registrados.</p>
            <p class="text-xs mt-1">Cada vez que uses el Protocolo de Cierre quedará guardado aquí.</p>
          </div>
        ` : allLogs.map(l => this.renderBitacoraItem(l)).join('')}
      </div>
    `;
  },

  renderBitacoraItem(log) {
    const d = new Date(log.date);
    const dateStr = d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

    return `
      <div class="bitacora-entry p-4 rounded-2xl theme-card border theme-border shadow-sm transition hover:brightness-105">
        <div class="flex items-center justify-between gap-2 mb-2">
          <div class="flex items-center gap-2">
            <span class="text-base">${log.projectEmoji}</span>
            <span class="text-xs font-bold">${log.projectName}</span>
            ${log.duration ? `<span class="text-[10px] font-mono px-2 py-0.5 rounded-full theme-card-subtle theme-text-muted">${log.duration} min</span>` : ''}
          </div>
          <span class="text-[11px] font-mono theme-text-muted">${dateStr}</span>
        </div>

        <p class="text-sm font-medium leading-relaxed">${log.achievement}</p>

        ${log.nextStep ? `
          <div class="mt-2.5 pt-2 border-t theme-border flex items-center gap-2 text-xs text-emerald-400 font-semibold">
            <span>→ Llave de reingreso:</span>
            <span class="theme-text-muted font-normal">${log.nextStep}</span>
          </div>
        ` : ''}
      </div>
    `;
  },

  filterBitacora(query) {
    const q = (query || '').toLowerCase().trim();
    document.querySelectorAll('.bitacora-entry').forEach(el => {
      const text = el.innerText.toLowerCase();
      el.style.display = text.includes(q) ? 'block' : 'none';
    });
  },

  // ==========================================
  // VISTA 4: RADAR DE PROYECTOS & CARTERA
  // ==========================================
  renderViewRadar(container) {
    const projects = this.state.projects || [];
    const execCount = projects.filter(p => p.status === 'en_ejecucion').length;
    const activeCount = projects.filter(p => p.status === 'activo').length;
    const pausedCount = projects.filter(p => p.status === 'pausado').length;
    const ideaCount = projects.filter(p => p.status === 'idea').length;
    const doneCount = projects.filter(p => p.status === 'completado').length;

    container.innerHTML = `
      <div class="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span class="text-xs font-mono font-bold uppercase text-emerald-400 tracking-wider">Gestión Multiactiva</span>
          <h1 class="text-2xl sm:text-3xl font-display font-extrabold mt-0.5">
            Radar de Proyectos
          </h1>
          <p class="text-xs theme-text-muted mt-1">Rota, incuba o despierta proyectos sin culpa cuando tus intereses cambien.</p>
        </div>

        <button onclick="app.openProjectModal()" class="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-md shadow-brand-500/20 active:scale-95 transition self-start md:self-auto">
          + Crear Proyecto
        </button>
      </div>

      <!-- Métricas de Cartera -->
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
        <div class="p-4 rounded-2xl theme-card border border-rose-500/40">
          <span class="text-xs text-rose-300 font-semibold block">🔥 En Ejecución</span>
          <span class="text-2xl font-display font-extrabold text-rose-400 mt-1 block">${execCount} / 3</span>
        </div>
        <div class="p-4 rounded-2xl theme-card border theme-border">
          <span class="text-xs theme-text-muted font-semibold block">⚡ Activos (Radar)</span>
          <span class="text-2xl font-display font-extrabold mt-1 block">${activeCount}</span>
        </div>
        <div class="p-4 rounded-2xl theme-card border theme-border">
          <span class="text-xs theme-text-muted font-semibold block">🟡 En Incubadora</span>
          <span class="text-2xl font-display font-extrabold text-amber-400 mt-1 block">${pausedCount}</span>
        </div>
        <div class="p-4 rounded-2xl theme-card border theme-border">
          <span class="text-xs theme-text-muted font-semibold block">🔵 Chispas / Ideas</span>
          <span class="text-2xl font-display font-extrabold text-sky-400 mt-1 block">${ideaCount}</span>
        </div>
        <div class="p-4 rounded-2xl theme-card border theme-border">
          <span class="text-xs theme-text-muted font-semibold block">🟣 Victorias Finales</span>
          <span class="text-2xl font-display font-extrabold text-purple-400 mt-1 block">${doneCount}</span>
        </div>
      </div>

      <!-- Lista de Proyectos Organizados por Estado -->
      <div class="space-y-6">
        ${['en_ejecucion', 'activo', 'pausado', 'idea', 'completado'].map(st => {
          const group = projects.filter(p => p.status === st);
          const titles = {
            en_ejecucion: '🔥 En Ejecución (Foco Inmediato - Máx. 3)',
            activo: '⚡ Activos (En Radar)',
            pausado: '🟡 En Incubadora / Pausados (Sin Culpa)',
            idea: '🔵 Chispas & Semillas Futuras',
            completado: '🟣 Proyectos Completados'
          };

          return `
            <div>
              <h3 class="text-xs font-mono font-bold uppercase tracking-wider theme-text-muted mb-3">${titles[st]} (${group.length})</h3>
              ${group.length === 0 ? `
                <p class="text-xs theme-text-muted italic py-2">Ninguno en este estado.</p>
              ` : `
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  ${group.map(p => `
                    <div class="p-4 rounded-2xl theme-card border ${st === 'en_ejecucion' ? 'border-rose-500/50 bg-rose-950/10' : 'theme-border'} flex items-center justify-between gap-3">
                      <div class="flex items-center gap-3">
                        <span class="text-2xl">${p.emoji || '🎯'}</span>
                        <div>
                          <h4 class="font-bold text-sm">${this.escapeHtml(p.name)}</h4>
                          <p class="text-[11px] theme-text-muted truncate max-w-[180px]">${this.escapeHtml(p.nextAction || 'Sin acción')}</p>
                        </div>
                      </div>
                      <div class="flex items-center gap-1.5">
                        <button onclick="app.cycleProjectStatus('${p.id}')" class="px-2.5 py-1 rounded-lg theme-card-subtle text-[10px] font-semibold hover:brightness-110" title="Rotar estado">
                          Rotar ↺
                        </button>
                        <button onclick="app.openProjectModal('${p.id}')" class="p-1 theme-text-muted hover:text-white text-xs" title="Editar proyecto">
                          ⚙️
                        </button>
                      </div>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  cycleProjectStatus(projectId) {
    const order = ['en_ejecucion', 'activo', 'pausado', 'idea', 'completado'];
    const p = this.state.projects.find(x => x.id === projectId);
    if (!p) return;
    const idx = order.indexOf(p.status);
    let nextStatus = order[(idx + 1) % order.length];
    if (nextStatus === 'en_ejecucion') {
      const currentExec = (this.state.projects || []).filter(x => x.status === 'en_ejecucion' && x.id !== projectId);
      if (currentExec.length >= 3) {
        nextStatus = 'activo';
        this.showToast('⚠️ Límite TDAH: Ya tienes 3 proyectos en ejecución. Pasando a Activo (En Radar).');
      }
    }
    p.status = nextStatus;
    this.saveState();
    this.render();
  },
});
