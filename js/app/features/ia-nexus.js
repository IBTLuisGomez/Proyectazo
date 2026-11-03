'use strict';
// Funciones con IA: desglose de metas, huecos en el calendario, reactivación, trabajo profundo y asistente Nexus.
// Métodos de ProyectazoApp (la clase base está en js/app.js).

defineAppMethods({

  // ==========================================
  // CAPACIDADES NUCLEARES: IA DECONSTRUCTION, GAP FILLING & REACTIVACIÓN
  // ==========================================
  openDeconstructModal(projectId = null, defaultGoal = '') {
    const p = projectId ? this.state.projects.find(x => x.id === projectId) : (this.state.projects.find(x => x.id === this.selectedKanbanProjectId) || this.state.projects[0]);
    const targetGoal = defaultGoal || (p ? (p.objective || p.nextAction || p.name) : 'Meta general');
    this.deconstructWithGemini(targetGoal, p ? p.id : null);
  },

  async deconstructWithGemini(goalText, projectId) {
    const body = document.getElementById('ai-deconstruct-body');
    if (!body) return;

    const p = projectId ? this.state.projects.find(x => x.id === projectId) : null;
    const queryGoal = (goalText || (p ? (p.objective || p.name) : 'Meta')).trim();

    body.innerHTML = `
      <div class="py-10 flex flex-col items-center justify-center text-center space-y-3">
        <div class="w-10 h-10 border-3 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        <div>
          <p class="font-bold text-sm text-amber-300">Desarmando la meta con Gemini...</p>
          <p class="text-[11px] theme-text-muted mt-1">Extrayendo Kickstart Action (&lt;10m) y micro-pasos de 15 a 20 minutos.</p>
        </div>
      </div>
    `;
    this.openModal('modal-ai-deconstruction');

    let data = null;
    try {
      const res = await fetch(`${this.NEXUS_API_BASE}/deconstruct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: queryGoal })
      });
      if (res.ok) {
        data = await res.json();
      }
    } catch (err) {
      console.warn("Nexus service not reached, using heuristic schema fallback", err);
    }

    if (!data || !data.kickstart_action) {
      data = {
        goal_title: queryGoal,
        kickstart_action: `Abrir el bloc de notas y titular "${queryGoal.slice(0, 35)}" (menos de 5 min)`,
        atomic_steps: [
          `Listar los 2 requisitos esenciales de ${queryGoal.slice(0, 25)}`,
          `Crear la estructura inicial sin buscar perfección`,
          `Escribir la primera función o bloque concreto`,
          `Revisar 10 min y registrar logro en Bitácora`
        ],
        estimated_total_minutes: 65,
        anti_optimism_notes: 'Buffer +30% aplicado para contrarrestar la ceguera temporal habitual del TDAH.'
      };
    }

    this.lastDeconstruction = { data, projectId: p ? p.id : null, goalText: queryGoal };
    this.renderAIDeconstructionResult(data, p);
  },

  renderAIDeconstructionResult(data, project) {
    const body = document.getElementById('ai-deconstruct-body');
    if (!body) return;

    const steps = data.atomic_steps || [];
    const firstTwo = steps.slice(0, 2);
    const remaining = steps.slice(2);
    const pId = project ? project.id : (this.selectedKanbanProjectId || (this.state.projects[0] ? this.state.projects[0].id : ''));

    body.innerHTML = `
      <div class="space-y-4">
        <!-- Header Meta -->
        <div class="p-3.5 rounded-2xl theme-card-subtle border theme-border flex items-center justify-between">
          <div>
            <span class="text-[10px] font-mono text-amber-400 font-bold uppercase tracking-wider block">Meta Analizada</span>
            <h4 class="font-display font-bold text-sm text-white">${data.goal_title || 'Meta TDAH'}</h4>
          </div>
          <div class="text-right">
            <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30">
              ⏱️ ${data.estimated_total_minutes || 60}m reales (+30%)
            </span>
          </div>
        </div>

        <!-- 1. KICKSTART ACTION OBLIGATORIO (PRIMER PASO CLARO) -->
        <div class="p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-cyan-500/15 border-2 border-emerald-500/50 shadow-lg shadow-emerald-500/10">
          <div class="flex items-center justify-between mb-1.5">
            <span class="text-xs font-mono font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <span>🚀</span> Primer Paso Claro (Kickstart Action)
            </span>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
              &lt; 5-10 min · Resistencia Cero
            </span>
          </div>
          <p class="text-sm font-bold text-white leading-snug mb-3">
            ${data.kickstart_action}
          </p>
          <button onclick="app.startKickstartInOneThing('${pId}', '${this.jsStr(data.kickstart_action)}')" class="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-display font-extrabold text-xs shadow-md shadow-emerald-500/20 active:scale-95 transition flex items-center justify-center gap-2">
            <span>🎯</span> Arrancar YA en Modo Solo 1 Cosa
          </button>
        </div>

        <!-- 2. PASOS ATÓMICOS CON PROGRESSIVE DISCLOSURE (EVITA EL AGOBIO) -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <span>🧩</span> Micro-pasos Inmediatos (15 a 20 min máx)
            </span>
            <span class="text-[10px] font-mono theme-text-muted">Desglose secuencial</span>
          </div>

          <div class="space-y-1.5">
            ${firstTwo.map((st, i) => `
              <div class="p-2.5 rounded-xl theme-card-subtle border theme-border flex items-start gap-2.5">
                <span class="w-5 h-5 rounded-lg bg-slate-800 text-amber-400 font-mono text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                  ${i + 1}
                </span>
                <span class="text-xs text-slate-200 leading-snug flex-1">${st}</span>
                <span class="text-[10px] font-mono theme-text-muted shrink-0">15m</span>
              </div>
            `).join('')}

            ${remaining.length > 0 ? `
              <div id="ai-deconstruct-expanded-steps" class="hidden space-y-1.5 pt-1">
                ${remaining.map((st, i) => `
                  <div class="p-2.5 rounded-xl theme-card-subtle border theme-border flex items-start gap-2.5">
                    <span class="w-5 h-5 rounded-lg bg-slate-800 text-slate-400 font-mono text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      ${i + 3}
                    </span>
                    <span class="text-xs text-slate-200 leading-snug flex-1">${st}</span>
                    <span class="text-[10px] font-mono theme-text-muted shrink-0">15m</span>
                  </div>
                `).join('')}
              </div>

              <button id="ai-deconstruct-toggle-btn" onclick="app.toggleExpandedDeconstructSteps()" class="w-full py-1.5 text-center text-xs font-semibold theme-text-muted hover:text-white transition">
                👁️ Ver los ${remaining.length} pasos siguientes (ocultos para no saturarte) ↓
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Nota Anti-Optimismo -->
        <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300/90 flex items-center gap-2">
          <span>🛡️</span>
          <span><strong>Consejo Anti-Optimismo:</strong> ${data.anti_optimism_notes || 'Tiempos expandidos un +30% para proteger tu tranquilidad.'}</span>
        </div>

        <!-- Toolbar inferior -->
        <div class="flex items-center justify-end gap-2 pt-2 border-t theme-border">
          <button onclick="app.closeModal('modal-ai-deconstruction')" class="px-4 py-2 rounded-xl theme-card-subtle border theme-border text-xs font-semibold hover:brightness-110">
            Cerrar
          </button>
          <button onclick="app.injectAtomicStepsToProject('${pId}')" class="px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5">
            <span>➕</span> Inyectar Micro-pasos al Kanban
          </button>
        </div>
      </div>
    `;
  },

  toggleExpandedDeconstructSteps() {
    const el = document.getElementById('ai-deconstruct-expanded-steps');
    const btn = document.getElementById('ai-deconstruct-toggle-btn');
    if (el && btn) {
      if (el.classList.contains('hidden')) {
        el.classList.remove('hidden');
        btn.textContent = 'Ocultar pasos profundos ↑';
      } else {
        el.classList.add('hidden');
        btn.textContent = '👁️ Ver pasos siguientes ↓';
      }
    }
  },

  startKickstartInOneThing(projectId, kickstartTitle) {
    let p = this.state.projects.find(x => x.id === projectId) || this.state.projects[0];
    if (!p) return;

    if (!p.tasks) p.tasks = [];
    const kickTask = {
      id: this.uid(),
      title: kickstartTitle,
      column: 'enfoco',
      effort: 'S',
      isKickstart: true,
      createdAt: new Date().toISOString()
    };
    p.tasks.unshift(kickTask);
    p.nextAction = kickstartTitle;
    p.lastActivity = new Date().toISOString();
    this.saveState();

    this.closeModal('modal-ai-deconstruction');
    this.openOneThingMode(p.id, kickTask.id);
  },

  injectAtomicStepsToProject(projectId) {
    const info = this.lastDeconstruction;
    if (!info || !info.data) return;

    let p = this.state.projects.find(x => x.id === projectId) || this.state.projects[0];
    if (!p) return;

    if (!p.tasks) p.tasks = [];

    // Inyectar pasos
    const steps = info.data.atomic_steps || [];
    steps.forEach((st, idx) => {
      p.tasks.push({
        id: this.uid(),
        title: st,
        column: idx === 0 ? 'proximo' : 'buzon',
        effort: 'S',
        createdAt: new Date().toISOString()
      });
    });

    this.saveState();
    this.triggerDopamineReward();
    this.closeModal('modal-ai-deconstruction');
    this.selectedKanbanProjectId = p.id;
    this.navigate('kanban');
    alert(`✓ ¡${steps.length} micro-pasos inyectados en el Kanban de "${p.name}"!`);
  },

  // ==========================================
  // SINCRONIZACIÓN INTELIGENTE CON EL CALENDARIO (GAP FILLING & BUFFERS)
  // ==========================================
  openGapFillingModal(taskId, taskTitle, estimatedMinutes = 30, projectId = null) {
    const p = projectId ? this.state.projects.find(x => x.id === projectId) : (this.state.projects.find(x => x.id === this.selectedKanbanProjectId) || this.state.projects[0]);
    const task = (p?.tasks || []).find(t => t.id === taskId) || { id: taskId, title: taskTitle || 'Micro-tarea' };

    const rawMinutes = parseInt(estimatedMinutes) || 30;
    const antiOptimismMinutes = Math.round(rawMinutes * 1.3); // +30% anti-optimism
    const bufferPrep = 15;
    const bufferDecomp = 15;

    // Hueco mañana a las 10:00 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const startIso = tomorrow.toISOString().slice(0, 16);

    const body = document.getElementById('gap-filling-body');
    if (!body) return;

    body.innerHTML = `
      <div class="space-y-4">
        <div class="p-4 rounded-2xl theme-card-subtle border theme-border">
          <div class="flex items-center gap-2 mb-1">
            <span class="text-xs font-mono font-bold uppercase text-blue-400">Tarea Seleccionada</span>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300">${p.emoji || '🎯'} ${p.name}</span>
          </div>
          <h4 class="font-display font-bold text-base text-white">${task.title}</h4>
        </div>

        <!-- Cálculo Anti-Ceguera Temporal -->
        <div class="grid grid-cols-3 gap-2.5 text-center">
          <div class="p-3 rounded-xl bg-slate-900/60 border border-slate-800">
            <span class="text-[10px] font-mono theme-text-muted uppercase block">Tu Estimación</span>
            <span class="text-sm font-bold text-slate-300">${rawMinutes} min</span>
          </div>
          <div class="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <span class="text-[10px] font-mono text-amber-300 uppercase block">+30% IA Realista</span>
            <span class="text-sm font-bold text-amber-400">${antiOptimismMinutes} min</span>
          </div>
          <div class="p-3 rounded-xl bg-blue-500/10 border border-blue-500/30">
            <span class="text-[10px] font-mono text-blue-300 uppercase block">Buffers (15m + 15m)</span>
            <span class="text-sm font-bold text-blue-400">+30 min</span>
          </div>
        </div>

        <!-- Explicación de los Buffers TDAH -->
        <div class="p-3.5 rounded-2xl bg-blue-500/5 border border-blue-500/20 text-[11px] text-blue-200/90 space-y-1.5">
          <div class="flex items-center gap-2 font-bold text-blue-300">
            <span>🛡️</span> Colchón de Transición (Task Switching Protection)
          </div>
          <p>
            • <strong>15 min antes:</strong> Entrada suave, abrir archivos, poner café, sin prisa.<br>
            • <strong>${antiOptimismMinutes} min:</strong> Foco en la tarea con tolerancia anti-optimismo.<br>
            • <strong>15 min después:</strong> Descompresión y bitácora para no saltar quemado a la siguiente actividad.
          </p>
        </div>

        <!-- Configuración del Slot de Calendario (El Veto del Usuario) -->
        <div class="p-3.5 rounded-2xl theme-card-subtle border theme-border space-y-3">
          <div class="flex items-center justify-between">
            <label class="font-bold text-xs">Hueco sugerido en Google Calendar:</label>
            <span class="text-[10px] font-mono text-emerald-400">Algoritmo Gap Filling</span>
          </div>
          <input type="datetime-local" id="gap-filling-datetime" value="${startIso}" class="w-full px-3 py-2 rounded-xl theme-card border theme-border font-mono text-xs focus:ring-2 focus:ring-blue-500 outline-none" />
          <p class="text-[10px] theme-text-muted">
            El Veto del Usuario: Puedes modificar la fecha/hora libremente antes de sincronizar.
          </p>
        </div>

        <!-- Botones de Acción -->
        <div class="flex items-center justify-end gap-2.5 pt-2">
          <button onclick="app.closeModal('modal-gap-filling')" class="px-4 py-2.5 rounded-xl theme-card-subtle border theme-border text-xs font-semibold hover:brightness-110">
            Cancelar
          </button>
          <button onclick="app.confirmGapFilling('${p.id}', '${task.id}', ${antiOptimismMinutes})" class="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-lg shadow-blue-500/25 active:scale-95 transition flex items-center gap-2">
            <span>📅</span> Añadir a Google Calendar
          </button>
        </div>
      </div>
    `;

    this.openModal('modal-gap-filling');
  },

  confirmGapFilling(projectId, taskId, sessionMinutes) {
    const p = this.state.projects.find(x => x.id === projectId);
    const task = (p?.tasks || []).find(t => t.id === taskId);
    const inputDt = document.getElementById('gap-filling-datetime')?.value;

    const baseTime = inputDt ? new Date(inputDt) : new Date();
    const bufferPrepMs = 15 * 60 * 1000;
    const sessionMs = sessionMinutes * 60 * 1000;
    const bufferDecompMs = 15 * 60 * 1000;

    const startTime = new Date(baseTime.getTime() + bufferPrepMs);
    const endTime = new Date(startTime.getTime() + sessionMs);

    const title = `⚡ [${p ? p.name : 'Proyectazo'}] ${task ? task.title : 'Micro-paso'}`;
    const details = `Bloque de Hiperfoco TDAH.\n• Buffer de entrada: 15 min antes (${baseTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})\n• Sesión activa (+30% anti-optimismo): ${sessionMinutes} min\n• Buffer de descompresión: 15 min después (${endTime.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})\n\nObjetivo: ${p ? p.objective : ''}`;

    const formatGCal = (d) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
    const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${formatGCal(baseTime)}/${formatGCal(new Date(endTime.getTime() + bufferDecompMs))}&details=${encodeURIComponent(details)}`;

    if (this.shaderEngine) {
      this.shaderEngine.setSmokeState('humo_azul');
      this.shaderEngine.pulseShockwave();
    }

    window.open(gcalUrl, '_blank');
    this.closeModal('modal-gap-filling');
    this.showNotification('📅 Bloque con buffers de 15 min enviado a Google Calendar.', 'success');
  },

  // ==========================================
  // SISTEMA ANTI-ABANDONO: RESUMEN DE REACTIVACIÓN CON IA & PAUSA SIN CULPA
  // ==========================================
  async reactivateProjectWithGemini(projectId) {
    const p = this.state.projects.find(x => x.id === projectId);
    if (!p) return;

    const body = document.getElementById('reactivation-briefing-body');
    if (!body) return;

    body.innerHTML = `
      <div class="py-10 flex flex-col items-center justify-center text-center space-y-3">
        <div class="w-10 h-10 border-3 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
        <div>
          <p class="font-bold text-sm text-purple-300">Reconectando con tu motivación original sin culpa...</p>
          <p class="text-[11px] theme-text-muted mt-1">Consultando a Gemini para restaurar tu contexto en segundos.</p>
        </div>
      </div>
    `;
    this.openModal('modal-reactivation-briefing');

    let data = null;
    const daysInactive = this.daysSince(p.lastActivity);
    try {
      const res = await fetch(`${this.NEXUS_API_BASE}/reactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: p.name,
          context: p.objective || p.name,
          logs: (p.logs || []).slice(0, 3)
        })
      });
      if (res.ok) {
        data = await res.json();
      }
    } catch (err) {
      console.warn("Nexus reactivate service offline, using cognitive heuristic", err);
    }

    if (!data || !data.where_you_left_off) {
      const lastLog = (p.logs && p.logs.length > 0) ? p.logs[0].achievement : 'Fase inicial de definición';
      data = {
        project_name: p.name,
        where_you_left_off: lastLog,
        why_it_matters: p.objective || 'Este proyecto encarna una visión clave para simplificar tu trabajo.',
        exact_next_step: p.nextAction || `Abrir el repositorio y revisar el archivo principal 5 minutos sin presión.`,
        encouraging_insight: `Llevas ${daysInactive} días en pausa. Tu cerebro necesitaba recargar energía. Cero culpa; estás exactamente a tiempo.`
      };
    }

    body.innerHTML = `
      <div class="space-y-4">
        <div class="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/30">
          <div class="flex items-center justify-between mb-2">
            <span class="text-xs font-mono font-bold uppercase text-purple-300 flex items-center gap-1.5">
              <span>${p.emoji || '🎯'}</span> ${p.name}
            </span>
            <span class="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-900 border theme-border theme-text-muted">
              ${daysInactive} días en pausa
            </span>
          </div>
          <p class="text-xs text-purple-200/90 italic">
            "${data.encouraging_insight}"
          </p>
        </div>

        <div class="space-y-3">
          <div class="p-3.5 rounded-2xl theme-card-subtle border theme-border">
            <span class="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold block mb-1">
              1. ¿En qué te quedaste?
            </span>
            <p class="text-xs leading-relaxed text-slate-200">
              ${data.where_you_left_off}
            </p>
          </div>

          <div class="p-3.5 rounded-2xl theme-card-subtle border theme-border">
            <span class="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold block mb-1">
              2. ¿Por qué era importante?
            </span>
            <p class="text-xs leading-relaxed text-slate-200">
              ${data.why_it_matters}
            </p>
          </div>

          <div class="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30">
            <span class="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold block mb-1">
              3. Siguiente micro-paso exacto (Sin pensar)
            </span>
            <p class="text-sm font-bold text-white leading-snug">
              ${data.exact_next_step}
            </p>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-end gap-2 pt-2">
          <button onclick="app.closeModal('modal-reactivation-briefing')" class="px-4 py-2.5 rounded-xl theme-card-subtle border theme-border text-xs font-semibold hover:brightness-110">
            Cerrar
          </button>
          <button onclick="app.confirmReactivateProject('${p.id}', '${this.jsStr(data.exact_next_step)}')" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-emerald-500 hover:from-purple-400 hover:to-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-purple-500/25 active:scale-95 transition flex items-center gap-2">
            <span>🚀</span> Despertar y Lanzar Solo 1 Cosa
          </button>
        </div>
      </div>
    `;
  },

  confirmReactivateProject(projectId, nextAction) {
    const p = this.state.projects.find(x => x.id === projectId);
    if (!p) return;

    // Verificar WIP limit al reactivar
    const activeCount = this.state.projects.filter(x => x.status === 'activo' && x.id !== projectId).length;
    if (activeCount >= 3) {
      this.showToast('⚠️ Máximo 3 proyectos activos para no saturar tu mente. Pon uno en pausa antes de reactivar este.');
      return;
    }

    p.status = 'activo';
    p.nextAction = nextAction;
    p.lastActivity = new Date().toISOString();
    this.saveState();
    this.closeModal('modal-reactivation-briefing');
    this.openOneThingMode(p.id);
    this.showNotification(`🌱 Proyecto "${p.name}" reactivado sin culpa.`, 'success');
  },

  hibernateProjectWithoutGuilt(projectId) {
    const p = this.state.projects.find(x => x.id === projectId);
    if (!p) return;
    p.status = 'hibernado';
    p.lastActivity = new Date().toISOString();
    this.saveState();
    this.render();
    this.showNotification(`❄️ "${p.name}" puesto en Pausa sin Culpa (hibernación). Tu energía puede concentrarse libremente.`, 'info');
  },

  openNexusInContext(projectId) {
    this.nexusContextProjectId = projectId;
    const p = this.state.projects.find(x => x.id === projectId);
    this.openNexusVoice(`proyecto:${p ? p.name : projectId}`);
  },

  // ==========================================
  // MODO TRABAJO PROFUNDO (DEEP WORK DRAWER / MODAL)
  // ==========================================
  openDeepWork(projectId, taskId) {
    const p = this.state.projects.find(x => x.id === projectId);
    if (!p) return;
    const task = (p.tasks || []).find(x => x.id === taskId);
    if (!task) return;

    this.currentDeepWork = { projectId, taskId };

    document.getElementById('deepwork-task-title').textContent = task.title;
    document.getElementById('deepwork-project-badge').textContent = `${p.emoji || '🎯'} ${p.name}`;
    document.getElementById('deepwork-notes').value = task.notes || '';
    document.getElementById('deepwork-code').value = task.codeSnippet || '';
    document.getElementById('deepwork-is-bureaucratic').checked = !!task.isBureaucratic;

    this.renderDeepworkSubsteps(task);
    this.openModal('deepwork-modal');
  },

  renderDeepworkSubsteps(task) {
    const list = document.getElementById('deepwork-substeps-list');
    if (!list) return;

    const steps = task.substeps || [];
    if (steps.length === 0) {
      list.innerHTML = `<div class="p-3 text-center text-slate-500 italic rounded-xl border border-dashed theme-border">Sin micro-pasos. Añade pasos de ≤5 min para evitar la parálisis.</div>`;
      return;
    }

    list.innerHTML = steps.map((s, idx) => `
      <div class="flex items-center gap-2 p-2 rounded-xl theme-card-subtle border theme-border">
        <input type="checkbox" ${s.done ? 'checked' : ''} onchange="app.toggleDeepworkSubstep(${idx})" class="rounded text-sky-500 focus:ring-0 cursor-pointer" />
        <span class="text-xs flex-1 ${s.done ? 'line-through text-slate-500' : 'font-medium'}">${s.text}</span>
        <button onclick="app.removeDeepworkSubstep(${idx})" class="text-xs text-rose-400 hover:text-rose-300 font-bold px-1">✕</button>
      </div>
    `).join('');
  },

  addDeepworkSubstep() {
    const text = prompt("Micro-paso concreto (≤5 min):");
    if (!text || !text.trim()) return;

    const { projectId, taskId } = this.currentDeepWork;
    const p = this.state.projects.find(x => x.id === projectId);
    const t = p ? (p.tasks || []).find(x => x.id === taskId) : null;
    if (!t) return;

    if (!t.substeps) t.substeps = [];
    t.substeps.push({ text: text.trim(), done: false });
    this.renderDeepworkSubsteps(t);
  },

  toggleDeepworkSubstep(idx) {
    const { projectId, taskId } = this.currentDeepWork;
    const p = this.state.projects.find(x => x.id === projectId);
    const t = p ? (p.tasks || []).find(x => x.id === taskId) : null;
    if (!t || !t.substeps || !t.substeps[idx]) return;

    t.substeps[idx].done = !t.substeps[idx].done;
    if (t.substeps[idx].done) this.triggerDopamineReward();
    this.renderDeepworkSubsteps(t);
  },

  removeDeepworkSubstep(idx) {
    const { projectId, taskId } = this.currentDeepWork;
    const p = this.state.projects.find(x => x.id === projectId);
    const t = p ? (p.tasks || []).find(x => x.id === taskId) : null;
    if (!t || !t.substeps) return;

    t.substeps.splice(idx, 1);
    this.renderDeepworkSubsteps(t);
  },

  saveDeepworkCard() {
    const { projectId, taskId } = this.currentDeepWork;
    const p = this.state.projects.find(x => x.id === projectId);
    const t = p ? (p.tasks || []).find(x => x.id === taskId) : null;
    if (!t) return;

    t.notes = document.getElementById('deepwork-notes').value.trim();
    t.codeSnippet = document.getElementById('deepwork-code').value.trim();
    t.isBureaucratic = document.getElementById('deepwork-is-bureaucratic').checked;

    this.saveState();
    this.closeModal('deepwork-modal');
    this.render();
  },

  // --- RECOMPENSA ESPECIAL POR TAREAS BUROCRÁTICAS / ABURRIDAS ---
  completeBureaucraticTask(projectId, taskId) {
    const p = this.state.projects.find(x => x.id === projectId);
    if (!p) return;
    const t = (p.tasks || []).find(x => x.id === taskId);
    if (!t) return;

    t.column = 'victorias';
    this.saveState();
    this.render();

    this.triggerDopamineReward();
    setTimeout(() => this.triggerDopamineReward(), 200);

    alert(`🎉 ¡VICTORIA ÉPICA CONTRA EL ABURRIMIENTO!\n\nHas completado una tarea burocrática/administrativa:\n"${t.title}"\n\n+100 Puntos de Dopamina. Tu yo del futuro te agradece haber vencido la fricción.`);
  },

  // ==========================================
  // ALGORITMO GAP FILLING (TIMEBLOCKING AUTOMÁTICO)
  // ==========================================
  generateTimeblockForNextAction() {
    const actionInput = document.getElementById('checkout-next-action');
    let taskTitle = actionInput ? actionInput.value.trim() : '';
    const pId = document.getElementById('checkout-project-id')?.value || this.selectedKanbanProjectId;
    const p = this.state.projects.find(x => x.id === pId);

    if (!taskTitle && p) {
      taskTitle = p.nextAction;
    }
    if (!taskTitle) {
      taskTitle = prompt("¿Qué micro-paso deseas agendar en tu calendario?", "Próxima acción clave");
      if (!taskTitle) return;
    }

    // Buscar próximo día laborable (mañana o lunes) a las 10:00 AM
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 1);
    if (targetDate.getDay() === 6) targetDate.setDate(targetDate.getDate() + 2);
    else if (targetDate.getDay() === 0) targetDate.setDate(targetDate.getDate() + 1);

    targetDate.setHours(10, 0, 0, 0);
    const endDate = new Date(targetDate.getTime() + 90 * 60 * 1000); // 90 min bloque

    const formatGCalDate = (d) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
    const startStr = formatGCalDate(targetDate);
    const endStr = formatGCalDate(endDate);

    const eventTitle = `⚡ FocusFlow [${p ? p.name : 'Proyectazo'}]: ${taskTitle}`;
    const eventDetails = `Bloque de Trabajo Profundo protegido para TDAH.\n\n🎯 Tarea: ${taskTitle}\n🧵 Hilo de Ariadna: Micro-paso inmediato.\n☕ Buffer de 15 min al terminar para descansar la mente.\n\nGenerado por el algoritmo Gap-Filling de FocusFlow OS.`;

    const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(eventTitle)}&dates=${startStr}/${endStr}&details=${encodeURIComponent(eventDetails)}`;

    // Abrir Google Calendar
    window.open(gcalUrl, '_blank');

    // Descargar .ics
    const icsContent = `BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//FocusFlow OS//Proyectazo//ES\nBEGIN:VEVENT\nSUMMARY:${eventTitle}\nDESCRIPTION:${eventDetails.replace(/\n/g, '\\n')}\nDTSTART:${startStr}\nDTEND:${endStr}\nEND:VEVENT\nEND:VCALENDAR`;
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `timeblock_${taskTitle.slice(0, 20).replace(/\s+/g, '_')}.ics`;
    document.body.appendChild(link);
    link.click();
    link.remove();

    alert(`✓ ¡Bloque agendado con éxito!\n\n📅 Fecha: ${targetDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })} a las 10:00 AM.\n⏱️ Duración: 90 min + 15 min buffer.\nSe abrió Google Calendar y se descargó el evento .ics.`);
  },

  // ==========================================
  // ASISTENTE NEXUS: EL IDEARIO (VOZ A KANBAN & IA GEMINI)
  // ==========================================
  openNexusVoice(context = 'general') {
    this.nexusContext = context;
    const modal = document.getElementById('nexus-voice-modal');
    if (modal) modal.classList.remove('hidden');
    const input = document.getElementById('nexus-input');
    if (input) input.value = '';
    const resultBox = document.getElementById('nexus-result-box');
    if (resultBox) resultBox.classList.add('hidden');
  },

  closeNexusVoice() {
    if (this.isNexusListening) {
      this.stopNexusListening();
    }
    this.nexusContextProjectId = null;
    const modal = document.getElementById('nexus-voice-modal');
    if (modal) modal.classList.add('hidden');
  },

  toggleNexusListening() {
    if (this.isNexusListening) {
      this.stopNexusListening();
    } else {
      this.startNexusListening();
    }
  },

  startNexusListening() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      const label = document.getElementById('nexus-status-label');
      const input = document.getElementById('nexus-input');
      if (label) label.textContent = 'Dictado no activo en este navegador. Escribe aquí tu comando:';
      if (input) {
        input.focus();
        input.placeholder = "Escribe tu comando o pensamiento para Nexus...";
      }
      return;
    }

    try {
      this.speechRecognition = new SpeechRec();
      this.speechRecognition.lang = 'es-ES';
      this.speechRecognition.continuous = false;
      this.speechRecognition.interimResults = true;

      const micWaves = document.getElementById('nexus-mic-waves');
      const micIcon = document.getElementById('nexus-mic-icon');
      const label = document.getElementById('nexus-status-label');
      const input = document.getElementById('nexus-input');

      if (micWaves) micWaves.classList.add('animate-pulse', 'bg-purple-500/40', 'border-purple-400');
      if (micIcon) micIcon.textContent = '🔊';
      if (label) label.textContent = 'Escuchando... Habla ahora.';

      this.speechRecognition.onresult = (event) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          transcript += event.results[i][0].transcript;
        }
        if (input) input.value = transcript;
      };

      this.speechRecognition.onend = () => {
        this.stopNexusListening();
        if (input && input.value.trim()) {
          this.processNexusCommand(input.value.trim());
        }
      };

      this.speechRecognition.onerror = (e) => {
        console.warn("Speech recognition error:", e);
        this.stopNexusListening();
      };

      this.speechRecognition.start();
      this.isNexusListening = true;
    } catch (err) {
      console.error("SpeechRecognition start error:", err);
      this.stopNexusListening();
    }
  },

  stopNexusListening() {
    if (this.speechRecognition) {
      try { this.speechRecognition.stop(); } catch(e){}
      this.speechRecognition = null;
    }
    this.isNexusListening = false;
    const micWaves = document.getElementById('nexus-mic-waves');
    const micIcon = document.getElementById('nexus-mic-icon');
    const label = document.getElementById('nexus-status-label');
    if (micWaves) micWaves.classList.remove('animate-pulse', 'bg-purple-500/40', 'border-purple-400');
    if (micIcon) micIcon.textContent = '🎙️';
    if (label) label.textContent = 'Presiona para hablar o escribe tu comando';
  },

  // Contrato de clasificación para la consola Nexus, con el clasificador local compartido
  classifyThoughtWithGeminiContract(text) {
    const local = CapturaParser.classifyLocal(text, { memory: this.state.settings?.classifierMemory });
    const cat = local.matched ? local.category : 'humo_general';
    const meta = SMOKE_PALETTE[cat] || SMOKE_PALETTE.humo_general;
    return {
      thought: text,
      category: cat,
      matched: local.matched,
      reasons: local.reasons,
      color_hex: meta.hex,
      color_vec3: meta.vec3,
      cognitive_weight: local.matched ? local.cognitiveWeight : 'libre',
      module: meta.module,
      action: meta.title,
      shader_params: meta.shader
    };
  },

  processNexusCommand(customText = '') {
    const text = (customText || document.getElementById('nexus-input')?.value || '').trim();
    if (!text) return;

    const lower = text.toLowerCase();
    let targetProjectId = null;
    let targetProject = null;
    let cleanTaskTitle = text;

    if (this.nexusContextProjectId) {
      targetProjectId = this.nexusContextProjectId;
      targetProject = this.state.projects.find(p => p.id === targetProjectId);
    }

    if (!targetProject) {
      const match = this.findProjectMatch(text);
      if (match) {
        targetProject = match.project;
        targetProjectId = match.project.id;
      }
    }

    const isPensaderoExplicit = lower.includes('pensamiento') || lower.includes('pensadero') || lower.includes('humo') || lower.includes('soltar') || lower.includes('olvidar');

    const resultBox = document.getElementById('nexus-result-box');
    const tagEl = document.getElementById('nexus-detected-tag');
    const summaryEl = document.getElementById('nexus-parsed-summary');
    const previewEl = document.getElementById('nexus-json-preview');
    const dotEl = document.getElementById('nexus-contract-color-dot');

    if (targetProject && !isPensaderoExplicit) {
      cleanTaskTitle = text
        .replace(/^nexus,?\s*/i, '')
        .replace(/^agrega\s+(al\s+proyecto\s+de\s+[a-záéíóúñ\s]+\s+que\s+)/i, '')
        .replace(/^agrega\s+(a\s+[a-záéíóúñ\s]+\s+que\s+)/i, '')
        .replace(/^recuérdame\s+(en\s+[a-záéíóúñ\s]+\s+que\s+)/i, '')
        .trim();
      if (cleanTaskTitle.length < 3) cleanTaskTitle = text;
      cleanTaskTitle = cleanTaskTitle.charAt(0).toUpperCase() + cleanTaskTitle.slice(1);

      this.pendingNexusAction = {
        type: 'add_task',
        projectId: targetProject.id,
        taskTitle: cleanTaskTitle
      };

      if (tagEl) tagEl.textContent = `Proyecto: ${targetProject.name}`;
      if (dotEl) {
        dotEl.style.background = targetProject.color || '#10b981';
        dotEl.style.boxShadow = `0 0 8px ${targetProject.color || '#10b981'}`;
      }
      if (summaryEl) summaryEl.innerHTML = `Crear nueva tarea en el Buzón de <strong>${this.escapeHtml(targetProject.emoji || '🎯')} ${this.escapeHtml(targetProject.name)}</strong>:<br>"${this.escapeHtml(cleanTaskTitle)}"`;
      if (previewEl) {
        previewEl.textContent = JSON.stringify({
          action: "add_task_to_backlog",
          project_id: targetProject.id,
          project_name: targetProject.name,
          task_title: cleanTaskTitle,
          cognitive_weight: "medio"
        }, null, 2);
      }
    } else {
      const contract = this.classifyThoughtWithGeminiContract(text);
      const meta = SMOKE_PALETTE[contract.category];

      this.pendingNexusAction = {
        type: 'pensadero',
        contract: contract
      };

      if (dotEl) {
        dotEl.style.background = contract.color_hex;
        dotEl.style.boxShadow = `0 0 10px ${contract.color_hex}`;
      }
      if (tagEl) {
        tagEl.textContent = `${meta.icon} ${meta.name} · Peso: ${contract.cognitive_weight}`;
      }
      if (summaryEl) {
        summaryEl.innerHTML = `
          <strong>Destino:</strong> ${meta.title}<br>
          <strong>Pensamiento:</strong> "${this.escapeHtml(text)}"
        `;
      }
      if (previewEl) {
        previewEl.textContent = JSON.stringify(contract, null, 2);
      }

      if (this.shaderEngine) {
        this.shaderEngine.setSmokeState(contract.category, contract.shader_params);
      }
    }

    if (resultBox) resultBox.classList.remove('hidden');
  },

  confirmNexusAction() {
    if (!this.pendingNexusAction) return;
    const act = this.pendingNexusAction;

    if (act.type === 'add_task') {
      const p = this.state.projects.find(x => x.id === act.projectId);
      if (p) {
        if (!p.tasks) p.tasks = [];
        p.tasks.push({
          id: this.uid(),
          title: act.taskTitle,
          column: 'buzon',
          effort: 'M',
          createdAt: new Date().toISOString()
        });
        this.saveState();
        this.triggerDopamineReward();
        this.closeNexusVoice();
        this.selectedKanbanProjectId = p.id;
        this.navigate('hacer');
        this.showToast(`✓ Idea agregada al Buzón de '${p.name}'`);
      }
    } else if (act.type === 'pensadero') {
      const c = act.contract;
      this.captureThought(c.thought, { source: 'nexus', category: c.matched ? c.category : null, skipSplit: true });
      if (this.shaderEngine) {
        this.shaderEngine.setSmokeState(c.category, c.shader_params);
        this.shaderEngine.pulseShockwave();
      }
      this.closeNexusVoice();
      this.navigate('soltar');
    }

    this.pendingNexusAction = null;
  },

  dictateField(fieldId) {
    const input = document.getElementById(fieldId);
    if (!input) return;

    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      input.focus();
      const origPlaceholder = input.placeholder;
      input.placeholder = "Dictado de voz no soportado en este navegador. Escribe aquí...";
      input.classList.add('ring-2', 'ring-amber-500');
      setTimeout(() => {
        input.placeholder = origPlaceholder;
        input.classList.remove('ring-2', 'ring-amber-500');
      }, 3500);
      return;
    }

    const rec = new SpeechRec();
    rec.lang = 'es-ES';
    rec.continuous = false;
    rec.interimResults = false;

    const origPlaceholder = input.placeholder;
    input.placeholder = "🎙️ Escuchando... Habla ahora...";
    input.classList.add('ring-2', 'ring-purple-500');

    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      if (input.tagName.toLowerCase() === 'textarea') {
        input.value = input.value ? (input.value + ' ' + transcript) : transcript;
      } else {
        input.value = transcript;
      }
    };

    rec.onend = () => {
      input.placeholder = origPlaceholder;
      input.classList.remove('ring-2', 'ring-purple-500');
    };

    rec.onerror = () => {
      input.placeholder = origPlaceholder;
      input.classList.remove('ring-2', 'ring-purple-500');
    };

    rec.start();
  },

  syncRedSmokeToGoogle(id, encodedText) {
    const text = decodeURIComponent(encodedText);
    const title = `🔴 URGENTE: ${text}`;
    const details = `Pendiente crítico de El Pensadero (FocusFlow OS / TDAH).\n\nCreado: ${new Date().toLocaleString('es-ES')}`;

    const now = new Date();
    const start = new Date(now.getTime() + 60 * 60 * 1000);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    const formatGCal = (d) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
    const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${formatGCal(start)}/${formatGCal(end)}&details=${encodeURIComponent(details)}`;

    window.open(gcalUrl, '_blank');
    alert(`✓ Sincronizando con Google:\nSe abrió Google Calendar para agendar este pendiente prioritario.`);
  },

  releaseWhiteSmoke(target) {
    const item = this.getPensaderoItem(target);
    if (!item) return;

    if (this.state.settings?.sound) {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (ctx.state === 'suspended') { ctx.resume(); }
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.6);
        gain.gain.setValueAtTime(0.04, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.6);
      } catch(e) {}
    }

    this.deletePensaderoItem(item.id);
    if (this.shaderEngine) {
      this.shaderEngine.setSmokeState('humo_blanco');
      this.shaderEngine.pulseShockwave();
    }
    alert("💨 Pensamiento soltado y disuelto en humo blanco.\nTu memoria de trabajo inmediata ha quedado liberada sin culpa.");
  },

  chewGoldSmoke(target) {
    const item = this.getPensaderoItem(target);
    if (!item) return;
    const step1 = prompt("Micro-paso 1 de 15 min (inmediato y sin fricción):", `Definir alcance básico de: ${item.content.slice(0, 30)}`);
    if (!step1) return;
    const step2 = prompt("Micro-paso 2 de 15 min:", "Buscar 2 referencias o herramientas existentes");
    const step3 = prompt("Micro-paso 3 de 15 min:", "Hacer prototipo mínimo viable");

    const steps = [step1, step2, step3].filter(Boolean);
    steps.forEach((s, i) => {
      this.state.pensadero.unshift({
        id: this.uid(),
        content: `[Paso ${i+1}/3 - 15m] ${s}`,
        category: 'humo_dorado',
        cognitiveWeight: 'ligero',
        module: 'Proyectos Oro',
        isPinned: false,
        isResolved: false,
        createdAt: new Date().toISOString()
      });
    });
    this.saveState();
    this.render();
    this.triggerDopamineReward();
    if (this.shaderEngine) {
      this.shaderEngine.setSmokeState('humo_dorado');
      this.shaderEngine.pulseShockwave();
    }
    alert(`✓ ¡Idea masticada en ${steps.length} micro-pasos de 15 minutos! Ahora es fácil de iniciar.`);
  },

  scheduleDeepWorkBlock(target) {
    const item = this.getPensaderoItem(target);
    if (!item) return;
    const now = new Date();
    const slotDate = new Date(now.getTime() + 24 * 3600 * 1000);
    slotDate.setHours(10, 15, 0, 0); // 15 min buffer after 10:00
    const endDate = new Date(slotDate.getTime() + 2 * 3600 * 1000); // 2 hours

    const title = `💻 DEEP WORK: ${item.content}`;
    const details = `Bloque de Hiperfoco TDAH.\nBuffer de preparación: 15 min.\nSesión: 2 horas ininterrumpidas.\nBuffer de descompresión: 15 min.`;
    const formatGCal = (d) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
    const gcalUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${formatGCal(slotDate)}/${formatGCal(endDate)}&details=${encodeURIComponent(details)}`;

    if (this.shaderEngine) {
      this.shaderEngine.setSmokeState('humo_azul');
      this.shaderEngine.pulseShockwave();
    }

    window.open(gcalUrl, '_blank');
    alert(`✓ Gap Filling Automático:\nSe agendó un bloque de 2 horas con buffers de 15 min de descanso antes y después en tu Google Calendar.`);
  },

  registerHabitStreak(target) {
    const item = this.getPensaderoItem(target);
    if (!item) return;
    item.streakCount = (item.streakCount || 0) + 1;
    item.lastCompleted = new Date().toISOString();
    this.saveState();
    this.render();
    this.triggerDopamineReward();
    if (this.shaderEngine) {
      this.shaderEngine.setSmokeState('humo_verde');
      this.shaderEngine.pulseShockwave();
    }
    alert(`🎉 ¡Racha alimentada! Llevas ${item.streakCount} días consecutivos en este hábito. Neurotransmisores de dopamina recargados.`);
  },

  openPersonalCRM(target) {
    const item = this.getPensaderoItem(target);
    if (!item) return;
    const name = item.contactName || "Carlos Méndez";
    const context = item.contactContext || "Le encanta el café de especialidad. Su mamá estuvo en el hospital la semana pasada. No hablar de política.";
    alert(`💜 AVATAR DE MEMORIA (CRM Personal)\n\nPersona: ${name}\nContexto: ${context}\n\n💡 Tip TDAH: Llama o envía un mensaje de voz breve ahora mismo. Ya tienes el contexto fresco para vencer la parálisis social.`);
    if (this.shaderEngine) {
      this.shaderEngine.setSmokeState('humo_purpura');
    }
  },

  registerFinancialFriction(target) {
    const item = this.getPensaderoItem(target);
    if (!item) return;
    const currentAmount = item.amount || 50;
    const res = prompt(`💳 Fricción Financiera TDAH\n\n¿Cuánto cuesta esta compra/gasto ($ USD)?`, currentAmount);
    if (res === null) return;
    const amount = parseFloat(res);
    if (isNaN(amount) || amount <= 0) return;

    item.amount = amount;
    const remaining = Math.max(0, this.freeMoneyMonthly - amount);
    const percent = Math.round((amount / this.freeMoneyMonthly) * 100);

    if (this.shaderEngine) {
      this.shaderEngine.setSmokeState('humo_naranja');
      this.shaderEngine.pulseShockwave();
    }

    const choice = confirm(`Impacto en tu Dinero Libre del Mes:\n\n• Gasto propuesto: $${amount} USD\n• Representa el ${percent}% de tu colchón mensual libre ($${this.freeMoneyMonthly} USD).\n• Dinero libre restante: $${remaining} USD.\n\n¿Deseas registrarlo como compra consciente [Aceptar] o enviarlo al congelador 72h para enfriar el impulso [Cancelar]?`);

    if (!choice) {
      item.category = 'humo_ceniza';
      item.hibernatedUntil = Date.now() + 3 * 86400000; // 72 hours cooldown
      this.saveState();
      this.render();
      alert(`❄️ Gasto enviado al congelador por 72 horas para evaluar si realmente lo necesitas.`);
    } else {
      this.freeMoneyMonthly = remaining;
      this.saveState();
      this.render();
      alert(`✓ Gasto registrado con consciencia. Colchón restante: $${remaining} USD.`);
    }
  },

  hibernateThought(target, days = 14) {
    const item = this.getPensaderoItem(target);
    if (!item) return;
    item.category = 'humo_ceniza';
    item.hibernatedUntil = Date.now() + days * 86400000;
    this.saveState();
    this.render();
    if (this.shaderEngine) {
      this.shaderEngine.setSmokeState('humo_ceniza');
    }
    alert(`❄️ Pensamiento hibernado por ${days} días.\nSe ha hundido en el núcleo del Pensadero para no sobrecargar tu pantalla.`);
  },

  wakeThought(target) {
    const item = this.getPensaderoItem(target);
    if (!item) return;
    item.hibernatedUntil = null;
    item.category = 'humo_dorado';
    this.saveState();
    this.render();
    if (this.shaderEngine) {
      this.shaderEngine.setSmokeState('humo_dorado');
      this.shaderEngine.pulseShockwave();
    }
    alert(`☀️ Pensamiento despertado y devuelto a Proyectos Oro.`);
  },

  sendPensaderoToFreeform(target) {
    const item = this.getPensaderoItem(target);
    if (!item) return;
    this.navigate('freeform');
    setTimeout(() => {
      if (this.freeform && this.freeform.ctx) {
        this.freeform.ctx.font = 'bold 16px sans-serif';
        this.freeform.ctx.fillStyle = '#f8fafc';
        this.freeform.ctx.fillText(item.content.slice(0, 50), 60, 60);
        this.saveFreeformState();
      }
    }, 150);
  },

  changeKanbanProject(projectId) {
    this.selectedKanbanProjectId = projectId;
    this.render();
  },

  openKanbanProject(projectId) {
    this.selectedKanbanProjectId = projectId;
    this.openDespegue(projectId);
  },

  handleDragStart(e, taskId) {
    e.dataTransfer.setData('text/plain', taskId);
    e.target.classList.add('card-dragging');
  },

  handleDragEnd(e) {
    e.target.classList.remove('card-dragging');
    document.querySelectorAll('.kanban-col').forEach(col => col.classList.remove('drag-over'));
  },

  handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  },

  handleDragLeave(e) {
    e.currentTarget.classList.remove('drag-over');
  },

  handleDrop(e, targetColumn) {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const taskId = e.dataTransfer.getData('text/plain');
    this.moveTaskToColumn(this.selectedKanbanProjectId, taskId, targetColumn);
  },

  moveTaskToColumn(projectId, taskId, targetColumn) {
    const project = this.state.projects.find(p => p.id === projectId);
    if (!project) return;
    const task = (project.tasks || []).find(t => t.id === taskId);
    if (!task || task.column === targetColumn) return;

    if (targetColumn === 'enfoco') {
      const currentEnfoco = (project.tasks || []).filter(t => t.column === 'enfoco');
      if (currentEnfoco.length >= 3) {
        this.openModal('modal-wip-warning');
        return;
      }
    }

    task.column = targetColumn;

    if (targetColumn === 'victorias') {
      if (task.isBureaucratic) {
        this.completeBureaucraticTask(projectId, taskId);
        return;
      }
      this.triggerDopamineReward();
    }

    this.saveState();
    this.render();

    if (this.backendAvailable) {
      fetch(`${this.API_BASE}/tasks/${taskId}/move`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ column: targetColumn })
      }).catch(() => {});
    }
  },

  moveTaskPrev(projectId, taskId) {
    const order = ['congelador', 'buzon', 'proximo', 'enfoco', 'esperando', 'victorias'];
    const project = this.state.projects.find(p => p.id === projectId);
    if (!project) return;
    const task = project.tasks.find(t => t.id === taskId);
    if (!task) return;
    const idx = order.indexOf(task.column);
    if (idx > 0) {
      this.moveTaskToColumn(projectId, taskId, order[idx - 1]);
    }
  },

  moveTaskNext(projectId, taskId) {
    const order = ['congelador', 'buzon', 'proximo', 'enfoco', 'esperando', 'victorias'];
    const project = this.state.projects.find(p => p.id === projectId);
    if (!project) return;
    const task = project.tasks.find(t => t.id === taskId);
    if (!task) return;
    const idx = order.indexOf(task.column);
    if (idx < order.length - 1) {
      this.moveTaskToColumn(projectId, taskId, order[idx + 1]);
    }
  },

  promptAddTask(projectId, columnKey) {
    this.openCreateTaskModal(projectId, columnKey);
  },

  deleteTask(projectId, taskId) {
    const project = this.state.projects.find(p => p.id === projectId);
    if (!project) return;
    project.tasks = (project.tasks || []).filter(t => t.id !== taskId);
    this.saveState();
    this.render();

    this.deleteOnServer('task', taskId); // encola si no hay red
  },
});
