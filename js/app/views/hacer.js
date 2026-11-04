'use strict';
// Vista "Hacer": lista de tareas y tablero Kanban.
// Métodos de ProyectazoApp (la clase base está en js/app.js).

defineAppMethods({

  // ==========================================
  // VISTA 3: ⚡ HACER (UNIFICACIÓN TAREAS + KANBAN TDAH)
  // La vista por defecto muestra el siguiente paso y en foco.
  // Las 5 columnas quedan detrás de 'Ver tablero'.
  // El límite de 3 se dice en frase humana.
  // ==========================================
  renderViewHacer(container) {
    if (!this.hacerMode) this.hacerMode = 'lista';
    if (!this.hacerProjectFilter) this.hacerProjectFilter = 'all';

    const projects = (this.state.projects || []).filter(p => !p.inBaul);
    if (projects.length === 0) {
      container.innerHTML = `
        <div class="max-w-md mx-auto p-10 text-center rounded-3xl bg-slate-900 border border-slate-800 space-y-4 my-8">
          <div class="w-16 h-16 mx-auto rounded-3xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-3xl">
            ⚡
          </div>
          <div>
            <h3 class="text-xl font-display font-extrabold text-white">Sin proyectos aún</h3>
            <p class="text-xs text-slate-400 mt-1 max-w-xs mx-auto">Crea tu primer proyecto para organizar tus tareas y activar el límite protector de 3 tareas en foco.</p>
          </div>
          <button onclick="app.openProjectModal()" class="px-5 py-2.5 rounded-2xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md transition flex items-center gap-2 mx-auto">
            <span>+</span> Crear Primer Proyecto
          </button>
        </div>
      `;
      return;
    }

    // Si está en modo tablero de 5 columnas
    if (this.hacerMode === 'tablero') {
      this.renderHacerTableroCompleto(container);
      return;
    }

    // Modo Lista de Enfoque (Por defecto)
    this.renderHacerListaEnfoque(container);
  },

  setHacerMode(mode) {
    this.hacerMode = mode;
    this.render();
  },

  renderHacerListaEnfoque(container) {
    const projects = this.state.projects || [];
    let allTasks = [];
    projects.forEach(p => {
      (p.tasks || []).forEach(t => {
        allTasks.push({
          ...t,
          projectId: p.id,
          projectName: p.name,
          projectEmoji: p.emoji || '📁',
          projectColor: p.color || '#3b82f6',
          projectStatus: p.status
        });
      });
    });

    let tasks = allTasks;
    if (this.hacerProjectFilter && this.hacerProjectFilter !== 'all') {
      tasks = tasks.filter(t => t.projectId === this.hacerProjectFilter);
    }

    const enfocoTasks = tasks.filter(t => t.column === 'enfoco');
    const proximoTasks = tasks.filter(t => t.column === 'proximo');
    const buzonTasks = tasks.filter(t => t.column === 'buzon');
    const victoriasCount = tasks.filter(t => t.column === 'victorias').length;
    const totalEnfoco = enfocoTasks.length;

    // Frase protectora TDAH del límite de 3
    let focusBanner = '';
    if (totalEnfoco === 0) {
      focusBanner = `
        <div class="p-3.5 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-300 flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <span class="text-base">💡</span>
            <span><strong>Memoria de trabajo despejada:</strong> No tienes tareas en foco. Elige una de tus próximas acciones para arrancar sin estrés.</span>
          </div>
        </div>`;
    } else if (totalEnfoco === 1) {
      focusBanner = `
        <div class="p-3.5 rounded-2xl bg-slate-900 border border-cyan-500/30 text-xs text-cyan-200 flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <span class="text-base">🎯</span>
            <span><strong>1 tarea en foco:</strong> Excelente para tu atención. Una sola cosa a la vez previene la sobrecarga.</span>
          </div>
          <button onclick="app.navigate('ahora')" class="px-3 py-1 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shrink-0 transition">
            Ir a Ahora ➔
          </button>
        </div>`;
    } else if (totalEnfoco === 2) {
      focusBanner = `
        <div class="p-3.5 rounded-2xl bg-slate-900 border border-cyan-500/30 text-xs text-cyan-200 flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <span class="text-base">⚡</span>
            <span><strong>2 de 3 tareas en foco:</strong> Buen ritmo. Mantén un máximo de 3 para proteger tu claridad mental.</span>
          </div>
          <button onclick="app.navigate('ahora')" class="px-3 py-1 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shrink-0 transition">
            Ir a Ahora ➔
          </button>
        </div>`;
    } else {
      focusBanner = `
        <div class="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-500/40 text-xs text-amber-200 flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <span class="text-base">⚠️</span>
            <span><strong>Foco completo (3 de 3 tareas):</strong> Termina una o muévela a 'después' antes de meter otra para no saturarte.</span>
          </div>
          <button onclick="app.navigate('ahora')" class="px-3 py-1 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold text-xs shrink-0 transition">
            Enfocar en Ahora ➔
          </button>
        </div>`;
    }

    container.innerHTML = `
      <div class="max-w-4xl mx-auto space-y-4 py-2">

        <!-- Barra Superior Hacer -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 class="text-2xl font-display font-extrabold text-white flex items-center gap-2">
              <span>⚡</span> Hacer
            </h1>
            <p class="text-xs text-slate-400 mt-0.5">Tus acciones inmediatas organizadas para arrancar sin parálisis.</p>
          </div>

          <div class="flex items-center gap-2 flex-wrap">
            <!-- Selector de Proyecto -->
            <select onchange="app.setHacerProjectFilter(this.value)" class="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 font-semibold focus:outline-none">
              <option value="all" ${this.hacerProjectFilter === 'all' ? 'selected' : ''}>Todos los proyectos</option>
              ${projects.map(p => `
                <option value="${p.id}" ${p.id === this.hacerProjectFilter ? 'selected' : ''}>
                  ${p.emoji || '🎯'} ${p.name}
                </option>
              `).join('')}
            </select>

            <!-- Botón de Tablero 5 Columnas -->
            <button onclick="app.setHacerMode('tablero')" class="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-semibold text-xs transition flex items-center gap-1.5">
              <span>📋</span> Ver tablero completo
            </button>

            <!-- Nueva Tarea -->
            <button onclick="app.openCreateTaskModal()" class="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition flex items-center gap-1">
              <span>+</span> Nueva Tarea
            </button>
          </div>
        </div>

        <!-- Banner Límite de 3 TDAH -->
        ${focusBanner}

        <!-- SECCIÓN 1: EN FOCO AHORA (MÁXIMO 3) -->
        <section class="space-y-2 pt-1">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-bold text-slate-200 flex items-center gap-2 font-display">
              <span>🔥</span> En Foco Ahora
              <span class="text-xs font-mono px-2 py-0.2 rounded-full ${totalEnfoco >= 3 ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-300'}">${totalEnfoco}/3</span>
            </h2>
          </div>

          ${enfocoTasks.length === 0 ? `
            <div class="p-6 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 text-slate-400">
              <p class="text-xs">No hay tareas en foco ahora. Elige un próximo paso abajo y haz clic en "Poner en Foco".</p>
            </div>
          ` : `
            <div class="space-y-2.5">
              ${enfocoTasks.map(t => this.renderHacerCard(t, true)).join('')}
            </div>
          `}
        </section>

        <!-- SECCIÓN 2: PRÓXIMOS PASOS (LISTOS PARA ARRANCAR) -->
        <section class="space-y-2 pt-2">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-bold text-slate-200 flex items-center gap-2 font-display">
              <span>🎯</span> Próximos Pasos (${proximoTasks.length})
            </h2>
          </div>

          ${proximoTasks.length === 0 ? `
            <div class="p-4 text-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/40 text-slate-400">
              <p class="text-xs">No hay próximos pasos definidos en este filtro.</p>
            </div>
          ` : `
            <div class="space-y-2">
              ${proximoTasks.map(t => this.renderHacerCard(t, false)).join('')}
            </div>
          `}
        </section>

        <!-- SECCIÓN 3: BUZÓN E IDEAS (PLEGABLE O SECUNDARIO) -->
        ${buzonTasks.length > 0 ? `
          <details class="rounded-2xl border border-slate-800 bg-slate-900/60 p-3 text-xs">
            <summary class="font-bold text-slate-400 cursor-pointer hover:text-white select-none">
              📥 Buzón / Ideas pendientes (${buzonTasks.length})
            </summary>
            <div class="space-y-2 mt-3 pt-2 border-t border-slate-800">
              ${buzonTasks.map(t => this.renderHacerCard(t, false)).join('')}
            </div>
          </details>
        ` : ''}

        <!-- Victorias acumuladas -->
        <div class="text-center pt-2">
          <span class="text-xs text-slate-500 font-mono">🏆 ${victoriasCount} micro-victorias registradas</span>
        </div>

      </div>
    `;
  },

  renderHacerCard(t, isEnFoco = false) {
    return `
      <div class="p-3.5 rounded-2xl bg-slate-900 border ${isEnFoco ? 'border-cyan-500/40 shadow-md ring-1 ring-cyan-500/20' : 'border-slate-800'} flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-xs">${t.projectEmoji}</span>
            <span class="text-[11px] font-bold text-slate-400 truncate">${t.projectName}</span>
            ${isEnFoco ? `<span class="text-[9px] font-mono px-2 py-0.2 rounded-full bg-cyan-500/20 text-cyan-300 font-bold">En Foco</span>` : ''}
          </div>
          <h3 class="text-sm font-bold text-white hover:text-cyan-300 transition cursor-pointer" onclick="app.openEditTaskModal('${t.projectId}', '${t.id}')">
            ${this.escapeHtml(t.title)}
          </h3>
          ${t.notes ? `<p class="text-xs text-slate-400 mt-0.5 line-clamp-1 italic">${this.escapeHtml(t.notes)}</p>` : ''}
        </div>

        <div class="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          ${isEnFoco ? `
            <button onclick="app.setHeroTaskAndFocus('${t.projectId}', '${t.id}')" class="px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-sm transition flex items-center gap-1">
              <span>▶</span> Enfocar
            </button>
          ` : `
            <button onclick="app.promoteTaskToFoco('${t.projectId}', '${t.id}')" class="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-xs font-semibold transition" title="Poner en foco (máx 3)">
              ⚡ Poner en foco
            </button>
          `}

          <button onclick="app.completeTaskAsVictory('${t.projectId}', '${t.id}', '${this.uriArg(t.title)}')" class="px-2.5 py-1.5 rounded-xl bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30 text-xs font-bold transition flex items-center gap-1" title="Marcar como Victoria">
            <span>✓</span> Victoria
          </button>

          <button onclick="app.breakdownTaskWithAI('${this.uriArg(t.title)}', '${t.projectId}')" class="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 text-xs transition" title="Desglose Atómico Gemini (micro-pasos de 15m)">
            🪄
          </button>

          <button onclick="app.openEditTaskModal('${t.projectId}', '${t.id}')" class="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition" title="Editar Tarea">
            ✏️
          </button>

          <button onclick="app.moveTaskToColumn('${t.projectId}', '${t.id}', 'congelador')" class="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-sky-300 border border-slate-700 text-xs transition" title="Mover a después (congelador)">
            ❄️
          </button>
        </div>
      </div>
    `;
  },

  setHacerProjectFilter(projId) {
    this.hacerProjectFilter = projId;
    this.render();
  },

  setHeroTaskAndFocus(projectId, taskId) {
    this.selectedKanbanProjectId = projectId;
    const p = (this.state.projects || []).find(x => x.id === projectId);
    if (p && p.tasks) {
      const t = p.tasks.find(x => x.id === taskId);
      if (t && t.column !== 'enfoco') {
        t.column = 'enfoco';
        this.saveState();
      }
    }
    this.navigate('ahora');
  },

  promoteTaskToFoco(projectId, taskId) {
    const p = (this.state.projects || []).find(x => x.id === projectId);
    if (!p || !p.tasks) return;
    const currentEnfoco = (p.tasks || []).filter(t => t.column === 'enfoco').length;
    if (currentEnfoco >= 3) {
      this.showToast("⚠️ Ya tienes 3 tareas en foco. Concluye una antes de agregar otra.");
      return;
    }
    const t = p.tasks.find(x => x.id === taskId);
    if (t) {
      t.column = 'enfoco';
      t.updatedAt = new Date().toISOString();
      this.saveState();
      this.showToast(`⚡ "${t.title.slice(0, 25)}..." puesta en foco`);
      this.render();
    }
  },

  completeTaskAsVictory(projectId, taskId, taskTitle) {
    const decoded = decodeURIComponent(taskTitle || 'Tarea');
    this.completeSprintAndRegisterVictory(projectId, taskId, decoded);
  },

  renderHacerTableroCompleto(container) {
    this.renderViewKanbanTablero(container);
  },

  renderViewKanban(container) {
    this.setHacerMode('tablero');
  },

  // ==========================================
  // VISTA KANBAN COMPLETA (5 COLUMNAS TRADICIONALES)
  // ==========================================
  renderViewKanbanTablero(container) {
    const projects = this.state.projects || [];
    if (projects.length === 0) {
      container.innerHTML = `
        <div class="max-w-md mx-auto p-10 text-center theme-card rounded-3xl border theme-border space-y-4 my-8">
          <div class="w-16 h-16 mx-auto rounded-3xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-3xl">
            ⚡
          </div>
          <div>
            <h3 class="text-xl font-display font-extrabold text-white">Sin proyectos aún</h3>
            <p class="text-xs theme-text-muted mt-1 max-w-xs mx-auto">Crea tu primer proyecto para desbloquear el tablero Kanban, descomponer metas con IA y activar el límite WIP de 3 tarjetas.</p>
          </div>
          <button onclick="app.openProjectModal()" class="px-5 py-2.5 rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-lg shadow-brand-500/20 active:scale-95 transition flex items-center gap-2 mx-auto">
            <span>+</span> Crear Primer Proyecto
          </button>
        </div>
      `;
      return;
    }

    if (!this.selectedKanbanProjectId || !projects.find(p => p.id === this.selectedKanbanProjectId)) {
      this.selectedKanbanProjectId = projects[0].id;
    }

    const project = projects.find(p => p.id === this.selectedKanbanProjectId);
    const tasks = project.tasks || [];

    // Si está en modo Tarjetas (Tinder-like para Celular)
    if (this.kanbanViewMode === 'tinder') {
      this.renderKanbanTinderMode(project, tasks, container);
      return;
    }

    const iceboxTasks = tasks.filter(t => t.column === 'congelador');

    const baseColumns = [
      { key: 'buzon', title: '📥 Buzón / Ideas', limit: null, desc: 'Todo lo que llega sin procesar' },
      { key: 'proximo', title: '🎯 Próximo Paso', limit: null, desc: 'Priorizadas para arrancar' },
      { key: 'enfoco', title: '⚡ En Foco (Máx 3)', limit: 3, desc: 'Máximo 3 para proteger tu mente' },
      { key: 'esperando', title: '⏳ En Espera', limit: null, desc: 'Bloqueado por un tercero' },
      { key: 'victorias', title: '🏆 Victorias', limit: null, desc: 'Logros que generan dopamina' }
    ];

    let columns = [...baseColumns];
    if (this.showIcebox) {
      columns.unshift({ key: 'congelador', title: '❄️ Congelador (Icebox)', limit: null, desc: 'Ideas guardadas para el futuro sin agobiar' });
    }

    const enfocoCount = tasks.filter(t => t.column === 'enfoco').length;

    container.innerHTML = `
      <!-- Header del Kanban con Selector y Checkpoints Cognitivos -->
      <div class="mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 mb-1">
            <span class="text-xs font-mono font-bold uppercase text-emerald-400 tracking-wider">Tablero Adaptativo TDAH</span>
            ${enfocoCount >= 3 ? `<span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">⚠️ Foco Completo (3/3)</span>` : ''}
            <span class="text-[10px] font-mono px-2 py-0.5 rounded-full border" style="border-color: ${project.color || '#10b981'}; color: ${project.color || '#10b981'}; background: ${project.color ? project.color + '15' : '#10b98115'}">Color Maestro</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-2xl">${project.emoji || '🎯'}</span>
            <select onchange="app.changeKanbanProject(this.value)" class="text-xl sm:text-2xl font-display font-extrabold bg-transparent border-b theme-border pb-0.5 focus:outline-none cursor-pointer">
              ${projects.map(p => `
                <option value="${p.id}" ${p.id === project.id ? 'selected' : ''} class="theme-card text-sm">
                  ${p.emoji || '🎯'} ${p.name} (${p.status})
                </option>
              `).join('')}
            </select>
          </div>
          ${project.objective ? `<p class="text-xs theme-text-muted mt-1">${project.objective}</p>` : ''}
          ${project.originThoughtContent ? `
            <div class="mt-1.5 flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-amber-300 max-w-xl truncate" title="Pensamiento original de El Pensadero">
              <span>🔮 Origen Pensadero:</span>
              <span class="truncate italic font-mono">"${project.originThoughtContent}"</span>
            </div>
          ` : ''}
        </div>

        <!-- Toolbar con Botones de Checkpoints Cognitivos y TDAH -->
        <div class="flex flex-wrap items-center gap-2">
          <!-- Volver a Lista de Enfoque -->
          <button onclick="app.setHacerMode('lista')" class="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition flex items-center gap-1.5 shadow-sm">
            <span>←</span> Volver a Lista
          </button>

          <!-- El Despegue -->
          <button onclick="app.openDespegue('${project.id}')" class="px-3.5 py-2 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-xs flex items-center gap-1.5 transition" title="Restaurar contexto: ¿Qué logré? y Próximo micro-paso">
            <span>🚀</span> Despegue
          </button>

          <!-- El Aterrizaje: Botón Gigante de Pausar Proyecto -->
          <button onclick="app.openCheckout('${project.id}')" class="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-display font-extrabold text-xs shadow-lg shadow-amber-500/20 active:scale-95 transition flex items-center gap-1.5" title="El Cierre TDAH: Bitácora rápida + El Hilo de Ariadna + Timeblocking">
            <span>⏸️</span> Pausar Proyecto (Aterrizaje)
          </button>

          <!-- Modo One Thing (Filtro de Ruido) -->
          <button onclick="app.openOneThingMode('${project.id}')" class="px-3 py-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 hover:bg-purple-500/30 font-bold text-xs flex items-center gap-1.5 transition" title="Pantalla negra enfocada en una sola tarea">
            <span>👁️</span> Solo 1 Cosa
          </button>

          <!-- Desglose Atómico Gemini -->
          <button onclick="app.openDeconstructModal('${project.id}')" class="px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold text-xs transition flex items-center gap-1" title="Desglosar meta con Gemini en micro-pasos de 15m y Kickstart Action">
            <span>🪄</span> Desglosar
          </button>

          <!-- Reactivación Anti-Abandono con IA -->
          <button onclick="app.reactivateProjectWithGemini('${project.id}')" class="px-3 py-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold text-xs transition flex items-center gap-1" title="Resumen Ejecutivo de Reactivación: ¿En qué te quedaste y por qué era importante?">
            <span>🌱</span> Reactivar
          </button>

          <!-- Alternador de Congelador (Icebox) -->
          <button onclick="app.toggleIcebox()" class="px-3 py-2 rounded-xl theme-card-subtle border ${this.showIcebox ? 'border-sky-500/50 text-sky-400 bg-sky-500/10' : 'theme-border theme-text-muted'} font-semibold text-xs transition" title="Ver u ocultar el congelador de ideas complejas">
            <span>❄️</span> Congelador (${iceboxTasks.length})
          </button>

          <!-- Selector de Vista Celular (Tarjetas Tinder) vs Panorámica (Tableta/PC) -->
          <button onclick="app.toggleKanbanViewMode()" class="px-3 py-2 rounded-xl theme-card-subtle border theme-border font-semibold text-xs hover:brightness-110 transition flex items-center gap-1" title="Alternar entre feed de tarjetas y columnas">
            <span>📱</span> Tarjetas
          </button>

          <!-- Captura Rápida en Contexto al Ideario/Pensadero -->
          <button onclick="app.openNexusInContext('${project.id}')" class="px-3 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 font-semibold text-xs transition flex items-center gap-1" title="Captura rápida por voz al Ideario en el contexto de este proyecto">
            <span>🎙️</span> Capturar
          </button>

          <!-- Modo Zen Hiperfoco -->
          <button onclick="app.openZenMode(app.state.projects.find(p=>p.id==='${project.id}'), '${this.jsStr(project.nextAction)}')" class="p-2 rounded-xl theme-card-subtle text-emerald-400 hover:brightness-110 text-xs border theme-border transition" title="Modo Zen Hiperfoco">
            🎯
          </button>

          <button onclick="app.openProjectModal('${project.id}')" class="p-2 rounded-xl theme-card-subtle theme-text-muted hover:brightness-110 text-xs border theme-border transition" title="Configurar proyecto">
            ⚙️
          </button>
        </div>
      </div>

      <!-- Columnas del Kanban con Drag and Drop y Recordador Cromático -->
      <div class="kanban-board" style="--kb-cols:${columns.length}">
        ${columns.map(col => {
          const colTasks = tasks.filter(t => t.column === col.key);
          const isOverLimit = col.limit && colTasks.length >= col.limit;

          return `
            <div class="theme-card-subtle rounded-2xl p-3 border theme-border flex flex-col min-h-[440px] transition-all kanban-col ${col.key === 'congelador' ? 'bg-slate-900/30 border-dashed border-sky-500/30' : ''}"
                 ondragover="app.handleDragOver(event)"
                 ondragleave="app.handleDragLeave(event)"
                 ondrop="app.handleDrop(event, '${col.key}')"
                 data-col="${col.key}">

              <div class="flex items-center justify-between pb-2 mb-2 border-b theme-border">
                <div>
                  <h4 class="text-xs font-bold">${col.title}</h4>
                  <p class="text-[10px] theme-text-muted font-mono">${col.desc}</p>
                </div>
                <span class="text-xs font-mono px-2 py-0.5 rounded-full ${isOverLimit ? 'bg-amber-500 text-white font-bold' : 'theme-card border theme-border theme-text-muted'}">
                  ${colTasks.length}${col.limit ? '/' + col.limit : ''}
                </span>
              </div>

              <div class="flex-1 space-y-2">
                ${colTasks.map(t => this.renderTaskCard(project, t, col.key)).join('')}
                ${colTasks.length === 0 ? `
                  <div class="p-6 text-center rounded-xl border border-dashed theme-border text-[11px] theme-text-muted">
                    ${col.key === 'congelador' ? 'Arrastra aquí tareas complejas para no saturar el presente' : 'Sin tarjetas'}
                  </div>
                ` : ''}
              </div>

              <div class="pt-2 mt-2 border-t theme-border">
                <button onclick="app.promptAddTask('${project.id}', '${col.key}')" class="w-full py-1.5 rounded-lg text-xs font-semibold theme-text-muted hover:brightness-125 transition flex items-center justify-center gap-1">
                  <span>+</span> Añadir tarea
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  },

  // --- MODO TARJETAS TINDER-LIKE PARA CELULAR (VERTICAL) ---
  renderKanbanTinderMode(project, tasks, container) {
    const pendingTasks = tasks.filter(t => t.column !== 'victorias');
    const total = pendingTasks.length;

    if (total === 0) {
      container.innerHTML = `
        <div class="max-w-md mx-auto p-8 rounded-3xl theme-card border theme-border text-center">
          <span class="text-4xl block mb-2">🎉</span>
          <h3 class="text-lg font-bold">¡Sin tareas pendientes en este proyecto!</h3>
          <p class="text-xs theme-text-muted mt-1">Todas las tareas están en victorias o en el congelador.</p>
          <div class="mt-4 flex items-center justify-center gap-2">
            <button onclick="app.promptAddTask('${project.id}', 'buzon')" class="px-4 py-2 rounded-xl bg-brand-600 text-white font-bold text-xs">
              + Nueva Tarea
            </button>
            <button onclick="app.toggleKanbanViewMode()" class="px-4 py-2 rounded-xl theme-card-subtle border theme-border font-bold text-xs">
              Ver columnas clásicas
            </button>
          </div>
        </div>
      `;
      return;
    }

    if (this.tinderCardIndex >= total) this.tinderCardIndex = 0;
    if (this.tinderCardIndex < 0) this.tinderCardIndex = total - 1;

    const task = pendingTasks[this.tinderCardIndex];
    const ageDays = this.daysSince(task.createdAt);
    const isCooling = (task.column === 'enfoco' || task.column === 'proximo') && ageDays >= 7;

    container.innerHTML = `
      <!-- Header Selector y Cambio de Modo -->
      <div class="mb-4 flex items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <span class="text-xl">${project.emoji || '🎯'}</span>
          <select onchange="app.changeKanbanProject(this.value)" class="text-lg font-extrabold bg-transparent border-b theme-border focus:outline-none">
            ${(this.state.projects || []).map(p => `
              <option value="${p.id}" ${p.id === project.id ? 'selected' : ''} class="theme-card text-xs">${p.emoji || '🎯'} ${p.name}</option>
            `).join('')}
          </select>
        </div>

        <div class="flex items-center gap-2">
          <button onclick="app.toggleKanbanViewMode()" class="px-3 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
            📋 Modo Columnas
          </button>
        </div>
      </div>

      <!-- TARJETA TINDER-LIKE (STITCH FOCUS CARD) -->
      <div class="max-w-md mx-auto relative select-none" id="dopamine-canvas-wrapper">
        <div id="active-tinder-card" class="p-6 rounded-3xl bg-slate-900/90 border-2 shadow-2xl transition-all relative overflow-hidden backdrop-blur-xl ${isCooling ? 'task-cooling' : ''}"
             style="border-color: ${project.color || '#4cd7f6'}; min-height: 380px; display: flex; flex-direction: column; justify-content: space-between;">

          <div>
            <!-- Tags de Cabecera (Stitch Style) -->
            <div class="flex items-center justify-between gap-2 mb-3">
              <span class="text-[10px] font-mono uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-slate-800 text-cyan-300 border border-cyan-500/30">
                ${project.emoji || '🎯'} ${this.escapeHtml(project.name)} • ${task.column.toUpperCase()}
              </span>
              <div class="flex items-center gap-1.5">
                <button onclick="app.openEditTaskModal('${project.id}', '${task.id}')" class="text-xs text-slate-400 hover:text-cyan-300 p-1 transition" title="Editar tarea (CRUD)">✏️</button>
                <span class="text-xs font-mono font-bold text-emerald-400">
                  ${this.tinderCardIndex + 1} de ${total}
                </span>
              </div>
            </div>

            ${isCooling ? `<div class="mb-2"><span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-300 border border-slate-600/50">❄️ Perdiendo inercia (${ageDays} días estancada)</span></div>` : ''}
            ${task.isBureaucratic ? `<div class="mb-2"><span class="badge-bureaucracy text-[10px] font-bold px-2 py-0.5 rounded-md">📑 Tarea Administrativa (Doble recompensa)</span></div>` : ''}

            <h2 class="text-xl sm:text-2xl font-display font-black text-white leading-snug mb-3 cursor-pointer hover:text-cyan-300 transition" onclick="app.openDeepWork('${project.id}', '${task.id}')">
              ${this.escapeHtml(task.title)}
            </h2>

            <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/70 border border-slate-800 text-[11px] font-mono text-slate-300 mb-3">
              <span>⏱️</span> <span>Micro-paso: ~10 min</span>
              <span class="text-slate-600">•</span>
              <span class="text-emerald-400 font-semibold">Dificultad Mínima</span>
            </div>

            ${task.notes ? `<p class="text-xs text-slate-300 line-clamp-3 mb-2 font-mono bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">${this.escapeHtml(task.notes)}</p>` : ''}
            ${task.codeSnippet ? `<p class="text-[11px] text-emerald-400 font-mono bg-slate-950 p-2 rounded-lg border border-slate-800 truncate">💻 Snippet de código adjunto</p>` : ''}
          </div>

          <!-- Acciones Táctiles Dopamínicas (Stitch Screen 2) -->
          <div class="pt-4 border-t border-slate-800 space-y-2.5">
            <div class="grid grid-cols-3 gap-2">
              <!-- Saltar sin culpa -->
              <button onclick="app.nextTinderCard()" class="p-3 rounded-2xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 text-xs font-bold flex flex-col items-center gap-1 transition active:scale-95" title="Saltar sin culpa: Cero remordimientos, conserva momentum">
                <span class="text-lg">⏭️</span>
                <span class="text-[10px] whitespace-nowrap">Sin culpa</span>
              </button>
              <!-- Llevar a Modo Zen -->
              <button onclick="app.launchZenForTask('${project.id}', '${task.id}', '${this.uriArg(task.title)}')" class="p-3 rounded-2xl bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 text-xs font-bold flex flex-col items-center gap-1 transition active:scale-95 border border-cyan-500/40 plasma-glow" title="Entrar en Modo Zen Hiperfoco">
                <span class="text-lg">🧘</span>
                <span class="text-[10px] whitespace-nowrap">Modo Zen</span>
              </button>
              <!-- ¡Victoria lograda! -->
              <button onclick="app.completeTinderVictory('${project.id}', '${task.id}', '${this.uriArg(task.title)}')" class="p-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs font-display font-extrabold flex flex-col items-center gap-1 transition active:scale-95 shadow-lg shadow-emerald-500/25 pulse-glow-tertiary" title="Marcar como Victoria y recibir dopamina">
                <span class="text-lg">🎉</span>
                <span class="text-[10px] whitespace-nowrap">¡Victoria!</span>
              </button>
            </div>

            <div class="flex items-center justify-between text-xs theme-text-muted pt-1">
              <button onclick="app.prevTinderCard()" class="px-2.5 py-1 rounded-lg hover:text-white">← Anterior</button>
              <button onclick="app.openDeepWork('${project.id}', '${task.id}')" class="text-sky-400 font-semibold hover:underline">💻 Notas & Detalle</button>
              <button onclick="app.swipeTinderAction('icebox', '${project.id}', '${task.id}')" class="text-slate-400 hover:text-cyan-300">❄️ Congelar</button>
            </div>
          </div>
        </div>
      </div>
    `;
  },

  toggleKanbanViewMode() {
    this.kanbanViewMode = (this.kanbanViewMode === 'tinder') ? 'columns' : 'tinder';
    this.tinderCardIndex = 0;
    this.render();
  },

  toggleIcebox() {
    this.showIcebox = !this.showIcebox;
    this.render();
  },

  swipeTinderAction(action, projectId, taskId) {
    if (action === 'icebox') {
      this.moveTaskToColumn(projectId, taskId, 'congelador');
    } else if (action === 'enfoco') {
      this.moveTaskToColumn(projectId, taskId, 'enfoco');
    } else if (action === 'done') {
      const p = this.state.projects.find(x => x.id === projectId);
      const t = (p?.tasks || []).find(x => x.id === taskId);
      if (t?.isBureaucratic) {
        this.completeBureaucraticTask(projectId, taskId);
      } else {
        this.moveTaskToColumn(projectId, taskId, 'victorias');
      }
    }
    this.tinderCardIndex++;
    this.render();
  },

  launchZenForTask(projectId, taskId, taskTitle) {
    this.selectedKanbanProjectId = projectId;
    const decoded = decodeURIComponent(taskTitle || '');
    this.currentOneThingTask = { projectId, taskId, title: decoded };
    this.navigate('zen');
  },

  completeTinderVictory(projectId, taskId, taskTitle) {
    const decoded = decodeURIComponent(taskTitle || '');

    // Acorde dopamínico C Major
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const notes = [523.25, 659.25, 783.99, 1046.50];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.08);
        gain.gain.setValueAtTime(0.18, ctx.currentTime + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.08 + 0.35);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + idx * 0.08);
        osc.stop(ctx.currentTime + idx * 0.08 + 0.4);
      });
    } catch(e) {}

    this.triggerDopamineReward();

    const p = this.state.projects.find(x => x.id === projectId);
    const t = (p?.tasks || []).find(x => x.id === taskId);
    if (t?.isBureaucratic) {
      this.completeBureaucraticTask(projectId, taskId);
    } else {
      this.moveTaskToColumn(projectId, taskId, 'victorias');
    }
    this.tinderCardIndex++;
    this.render();
  },

  nextTinderCard() {
    this.tinderCardIndex++;
    this.render();
  },

  prevTinderCard() {
    this.tinderCardIndex--;
    this.render();
  },

  // --- RENDER DE TARJETA KANBAN (CON RECORDADOR CROMÁTICO & ENFRIAMIENTO) ---
  renderTaskCard(project, task, currentColumn) {
    const projectId = typeof project === 'object' ? project.id : project;
    const projObj = (typeof project === 'object') ? project : this.state.projects.find(p => p.id === projectId);
    const masterColor = projObj ? projObj.color : '#10b981';

    // Lógica de degradado por enfriamiento (Stagnation >= 7 días)
    const ageDays = this.daysSince(task.createdAt);
    const isCooling = (task.column === 'enfoco' || task.column === 'proximo') && ageDays >= 7;

    return `
      <div class="p-3 rounded-xl theme-card border theme-border shadow-sm hover:border-brand-500/50 cursor-grab active:cursor-grabbing transition-all select-none group relative ${isCooling ? 'task-cooling' : ''}"
           style="border-left: 4px solid ${masterColor};"
           draggable="true"
           ondragstart="app.handleDragStart(event, '${task.id}')"
           ondragend="app.handleDragEnd(event)">

        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 cursor-pointer" onclick="app.openDeepWork('${projectId}', '${task.id}')">
            <p class="text-xs font-semibold leading-snug hover:text-emerald-400 transition">${this.escapeHtml(task.title)}</p>
            ${task.notes ? `<p class="text-[10px] theme-text-muted truncate mt-0.5">${this.escapeHtml(task.notes)}</p>` : ''}
            ${task.originThoughtContent ? `
              <div class="mt-1 text-[9px] text-amber-300/85 bg-amber-500/10 px-1.5 py-0.5 rounded flex items-center gap-1 truncate border border-amber-500/20" title="Pensadero: ${this.escapeHtml(task.originThoughtContent)}">
                <span>🔮</span> <span class="truncate italic">${this.escapeHtml(task.originThoughtContent)}</span>
              </div>
            ` : ''}
          </div>
          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
            <button onclick="app.openEditTaskModal('${projectId}', '${task.id}')" class="theme-text-muted hover:text-cyan-400 text-xs p-0.5" title="Editar tarea (CRUD)">✏️</button>
            <button onclick="app.deleteTaskWithUndo('${projectId}', '${task.id}')" class="theme-text-muted hover:text-rose-400 text-[10px] p-0.5" title="Eliminar">✕</button>
          </div>
        </div>

        <!-- Badges de Tarea: Enfriamiento & Administrativa -->
        <div class="flex items-center gap-1.5 flex-wrap mt-1.5">
          ${isCooling ? `
            <span class="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-slate-700/60 text-slate-300 border border-slate-600/50" title="Lleva ${ageDays} días sin avance. Sin alarmas estridentes.">
              ❄️ Perdiendo inercia (${ageDays}d)
            </span>
          ` : ''}

          ${task.isBureaucratic ? `
            <span class="badge-bureaucracy text-[9px] font-bold px-1.5 py-0.2 rounded-md" title="Tarea burocrática / administrativa: otorga doble recompensa al completarse">
              📑 Burocrática
            </span>
          ` : ''}

          ${task.codeSnippet ? `<span class="text-[9px] font-mono text-sky-400">💻 Código</span>` : ''}
          ${task.dueAt ? `<span class="text-[11px] px-1.5 py-0.5 rounded-full ${this.isDueTodayOrBefore(task.dueAt) ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30' : 'theme-card-subtle theme-text-muted'}">📅 ${this.formatDue(task.dueAt)}</span>` : ''}
        </div>

        <div class="flex items-center justify-between mt-2 pt-2 border-t theme-border">
          <div class="flex items-center gap-1">
            <span class="text-[9px] font-mono px-1.5 py-0.5 rounded theme-card-subtle theme-text-muted">
              ${task.effort || 'M'}
            </span>
            <button onclick="app.promptMasticarTask('${this.jsStr(task.title)}')" class="text-[9px] theme-text-muted hover:text-white px-1 py-0.5 rounded hover:bg-slate-700/50" title="Masticar en micro-pasos de 5 min">
              🍴
            </button>
            <button onclick="app.openOneThingMode('${projectId}', '${task.id}')" class="text-[9px] theme-text-muted hover:text-purple-300 px-1 py-0.5 rounded hover:bg-slate-700/50" title="Ver en Modo Solo 1 Cosa (Filtro de Ruido)">
              👁️
            </button>
            <button onclick="app.openGapFillingModal('${task.id}', '${this.jsStr(task.title)}', 30, '${projectId}')" class="text-[9px] theme-text-muted hover:text-blue-300 px-1 py-0.5 rounded hover:bg-slate-700/50" title="Gap Filling: Agendar en Google Calendar con buffers de 15 min y anti-optimismo">
              📅
            </button>
            <button onclick="app.openDeconstructModal('${projectId}', '${this.jsStr(task.title)}')" class="text-[9px] theme-text-muted hover:text-amber-300 px-1 py-0.5 rounded hover:bg-slate-700/50" title="Desglose Atómico Gemini (micro-pasos de 15m)">
              🪄
            </button>
            <button onclick="app.openScheduleEmailModal('${task.id}', '${this.jsStr(task.title)}', '${projectId}')" class="text-[9px] theme-text-muted hover:text-indigo-300 px-1 py-0.5 rounded hover:bg-slate-700/50" title="Programar recordatorio por Google Mail (Gmail)">
              📧
            </button>
            <button onclick="app.openDeepWork('${projectId}', '${task.id}')" class="text-[9px] theme-text-muted hover:text-sky-300 px-1 py-0.5 rounded hover:bg-slate-700/50" title="Abrir notas y fragmentos de código (Deep Work)">
              💻
            </button>
          </div>

          <!-- Botones de Acción Rápida -->
          <div class="flex items-center gap-1">
            ${currentColumn !== 'congelador' ? `
              <button onclick="app.moveTaskToColumn('${projectId}', '${task.id}', 'congelador')" class="w-5 h-5 rounded theme-card-subtle theme-text-muted hover:text-sky-300 flex items-center justify-center text-[10px]" title="Congelar sin culpa">
                ❄️
              </button>
            ` : ''}

            <button onclick="app.moveTaskPrev('${projectId}', '${task.id}')" class="w-5 h-5 rounded theme-card-subtle theme-text-muted hover:text-white flex items-center justify-center text-[10px] font-bold" title="Mover columna anterior">
              ←
            </button>
            <button onclick="app.moveTaskNext('${projectId}', '${task.id}')" class="w-5 h-5 rounded theme-card-subtle theme-text-muted hover:text-white flex items-center justify-center text-[10px] font-bold" title="Avanzar columna">
              →
            </button>

            ${currentColumn !== 'victorias' ? `
              <button onclick="${task.isBureaucratic ? `app.completeBureaucraticTask('${projectId}', '${task.id}')` : `app.moveTaskToColumn('${projectId}', '${task.id}', 'victorias')`}" class="w-5 h-5 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-slate-950 flex items-center justify-center text-[10px] font-bold transition" title="Marcar como Victoria">
                ✓
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  },
});
