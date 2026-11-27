'use strict';
// Micro-pasos dentro de una tarea: la tarea grande se queda como una sola tarjeta y dentro
// se ve "el siguiente paso" y cuánto falta. El modelo puro está en js/pasos-core.js.
// Principios: una sola acción a la vista (el siguiente paso), progreso visible, nada en rojo.
// Métodos de NexusHiveBrainApp (la clase base está en js/app.js).

defineAppMethods({

  _tareaPorId(projectId, taskId) {
    const project = (this.state.projects || []).find(p => p.id === projectId);
    const task = project && (project.tasks || []).find(t => t.id === taskId);
    return task ? { project, task } : null;
  },

  // Guarda y avisa al servidor solo de los pasos (PUT parcial). Sin red, la sincronización lo sube luego.
  _guardarPasos(task) {
    task.updatedAt = new Date().toISOString();
    this.saveState();
    if (this.backendAvailable) {
      fetch(`${this.API_BASE}/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ steps: task.steps })
      }).catch(() => {});
    }
  },

  // Resumen para tarjetas. variant 'card' (compacto) o 'hero' (vista Ahora: el siguiente paso en grande)
  renderPasosResumen(projectId, task, variant = 'card') {
    const steps = PasosCore.normalizar(task && task.steps);
    if (!steps.length) return '';
    const prog = PasosCore.progreso(steps);
    const sig = PasosCore.siguiente(steps);
    const color = (this.state.projects || []).find(p => p.id === projectId)?.color || '#10b981';
    const barra = `<div class="paso-barra" role="progressbar" aria-valuemin="0" aria-valuemax="${prog.total}" aria-valuenow="${prog.hechos}" aria-label="Micro-pasos hechos"><span style="width:${prog.pct}%; background:${color};"></span></div>`;

    if (variant === 'hero') {
      return `
        <div class="w-full max-w-md mx-auto mt-3 p-3 rounded-2xl theme-card-subtle border theme-border text-left space-y-2">
          ${sig ? `
            <div class="flex items-center gap-3">
              <button type="button" onclick="app.toggleTaskStep('${projectId}', '${task.id}', '${sig.id}')" class="w-11 h-11 shrink-0 rounded-full border-2 flex items-center justify-center text-lg font-bold transition active:scale-90 hover:brightness-110" style="border-color:${color}; color:${color};" title="Marcar este paso como hecho" aria-label="Hecho: ${this.escapeHtml(sig.text)}">✓</button>
              <div class="min-w-0">
                <p class="text-[11px] font-mono uppercase tracking-wider theme-text-muted">Solo esto ahora</p>
                <p class="text-sm font-bold leading-snug">${this.escapeHtml(sig.text)}</p>
              </div>
            </div>
          ` : `<p class="text-sm font-bold">🎉 Todos los pasos hechos</p>`}
          ${barra}
          <div class="flex items-center justify-between text-[11px] theme-text-muted">
            <span>${prog.hechos} de ${prog.total} pasos</span>
            <button type="button" onclick="app.openEditTaskModal('${projectId}', '${task.id}')" class="underline hover:brightness-125">Ver pasos</button>
          </div>
        </div>`;
    }

    return `
      <div class="mt-2 space-y-1">
        ${barra}
        <div class="flex items-center gap-1.5 text-[11px] theme-text-muted min-w-0">
          <span class="font-mono shrink-0">${prog.hechos}/${prog.total}</span>
          ${sig ? `
            <button type="button" onclick="event.stopPropagation(); app.toggleTaskStep('${projectId}', '${task.id}', '${sig.id}')" class="w-4 h-4 shrink-0 rounded border flex items-center justify-center text-[9px] hover:brightness-125" style="border-color:${color};" title="Marcar como hecho" aria-label="Hecho: ${this.escapeHtml(sig.text)}"></button>
            <span class="truncate" title="${this.escapeHtml(sig.text)}">${this.escapeHtml(sig.text)}</span>
          ` : '<span>✓ Pasos completos</span>'}
        </div>
      </div>`;
  },

  toggleTaskStep(projectId, taskId, stepId) {
    const found = this._tareaPorId(projectId, taskId);
    if (!found) return;
    const { task } = found;
    const antes = PasosCore.progreso(task.steps);
    task.steps = PasosCore.alternar(PasosCore.normalizar(task.steps), stepId);
    const despues = PasosCore.progreso(task.steps);
    this._guardarPasos(task);
    this.render();

    if (despues.hechos > antes.hechos) {
      // Micro-recompensa: vibración corta y un mensaje que cuenta lo hecho, nunca lo que falta
      if (this.state.settings?.vibration !== false) { try { navigator.vibrate(18); } catch (e) {} }
      if (despues.completo) {
        this.showToast('🎉 ¡Todos los pasos hechos!', () => this.completeTaskAsVictory(projectId, taskId, encodeURIComponent(task.title || '')), 'Marcar victoria');
      } else {
        const sig = PasosCore.siguiente(task.steps);
        this.showToast(`✓ Paso hecho (${despues.hechos}/${despues.total})${sig ? ' · Siguiente: ' + sig.text : ''}`);
      }
    }
  },

  // Pide pasos a la IA (/api/nexus/deconstruct); sin IA o sin red usa una plantilla corta
  async fetchStepSuggestions(title) {
    try {
      const res = await fetch(`${this.NEXUS_API_BASE}/deconstruct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: String(title || '').slice(0, 200) })
      });
      if (res.ok) {
        const pasos = PasosCore.desdeSugerencia(await res.json());
        if (pasos.length) return { pasos, ia: true };
      }
    } catch (e) { /* sin red: plantilla */ }
    return { pasos: PasosCore.plantilla(title), ia: false };
  },

  // 🪄 en las tarjetas: desglosa la tarea en pasos DENTRO de la propia tarea (no crea tarjetas nuevas)
  async breakTaskIntoSteps(projectId, taskId) {
    const found = this._tareaPorId(projectId, taskId);
    if (!found) return;
    const { task } = found;
    if (PasosCore.normalizar(task.steps).length) {
      this.openEditTaskModal(projectId, taskId);
      return;
    }
    this.showToast('🪄 Partiendo la tarea en pasos pequeños…');
    const { pasos, ia } = await this.fetchStepSuggestions(task.title);
    task.steps = pasos;
    this._guardarPasos(task);
    this.render();
    this.showToast(`✓ ${pasos.length} micro-pasos ${ia ? 'sugeridos por Nexus' : 'de inicio'}. Edítalos cuando quieras.`, () => this.openEditTaskModal(projectId, taskId), 'Ver pasos');
  },

  // ---------- Editor de pasos en el modal "Editar tarea" ----------
  // Se edita una copia (this._editSteps) y se guarda al pulsar "Guardar cambios".
  cargarPasosEdicion(task) {
    this._editSteps = PasosCore.normalizar(task && task.steps);
    this.renderEditTaskSteps();
  },

  renderEditTaskSteps() {
    const box = document.getElementById('edit-task-steps');
    if (!box) return;
    const steps = this._editSteps || [];
    const prog = PasosCore.progreso(steps);
    const label = document.getElementById('edit-task-steps-count');
    if (label) label.textContent = steps.length ? `${prog.hechos}/${prog.total}` : '';
    if (!steps.length) {
      box.innerHTML = `<p class="text-[11px] theme-text-muted px-1">Sin pasos. Escribe uno abajo o pulsa «✨ Sugerir» para partir la tarea en trozos de 5–15 min.</p>`;
      return;
    }
    box.innerHTML = steps.map((s, i) => `
      <div class="flex items-center gap-2 p-1.5 rounded-xl theme-card-subtle border theme-border">
        <input type="checkbox" ${s.done ? 'checked' : ''} onclick="app.toggleEditTaskStep(${i})" class="w-4 h-4 shrink-0 accent-emerald-500" aria-label="Paso hecho" />
        <input type="text" value="${this.escapeHtml(s.text)}" maxlength="140" onchange="app.renameEditTaskStep(${i}, this.value)"
          class="flex-1 min-w-0 bg-transparent text-xs focus:outline-none ${s.done ? 'paso-hecho' : ''}" aria-label="Texto del paso ${i + 1}" />
        <button type="button" onclick="app.moveEditTaskStep(${i}, -1)" class="w-6 h-6 shrink-0 rounded-lg theme-text-muted hover:brightness-125 text-xs ${i === 0 ? 'invisible' : ''}" title="Subir">↑</button>
        <button type="button" onclick="app.removeEditTaskStep(${i})" class="w-6 h-6 shrink-0 rounded-lg theme-text-muted hover:text-rose-400 text-xs" title="Quitar paso">✕</button>
      </div>
    `).join('');
  },

  addEditTaskStep(ev) {
    if (ev && typeof ev.preventDefault === 'function') ev.preventDefault(); // Enter no envía el formulario
    const input = document.getElementById('edit-task-step-input');
    const text = (input?.value || '').trim();
    if (!text) return;
    const steps = this._editSteps || [];
    if (steps.length >= PasosCore.MAX_PASOS) {
      this.showToast(`Máximo ${PasosCore.MAX_PASOS} pasos. Si hacen falta más, quizá sea otro proyecto.`);
      return;
    }
    this._editSteps = PasosCore.normalizar([...steps, { text }]);
    input.value = '';
    this.renderEditTaskSteps();
    input.focus();
  },

  toggleEditTaskStep(i) {
    const s = (this._editSteps || [])[i];
    if (!s) return;
    this._editSteps = PasosCore.alternar(this._editSteps, s.id);
    this.renderEditTaskSteps();
  },

  renameEditTaskStep(i, value) {
    const s = (this._editSteps || [])[i];
    if (!s) return;
    const text = String(value || '').trim();
    if (!text) { this.removeEditTaskStep(i); return; }
    s.text = text.slice(0, 140);
  },

  removeEditTaskStep(i) {
    (this._editSteps || []).splice(i, 1);
    this.renderEditTaskSteps();
  },

  moveEditTaskStep(i, dir) {
    const steps = this._editSteps || [];
    const j = i + dir;
    if (j < 0 || j >= steps.length) return;
    [steps[i], steps[j]] = [steps[j], steps[i]];
    this.renderEditTaskSteps();
  },

  async suggestTaskSteps() {
    const title = document.getElementById('edit-task-title')?.value || '';
    const btn = document.getElementById('edit-task-suggest-btn');
    if (btn) { btn.disabled = true; btn.textContent = '…'; }
    const { pasos } = await this.fetchStepSuggestions(title);
    // Se añaden a los que ya haya (sin repetir textos)
    const existentes = new Set((this._editSteps || []).map(s => s.text.toLowerCase()));
    this._editSteps = PasosCore.normalizar([...(this._editSteps || []), ...pasos.filter(p => !existentes.has(p.text.toLowerCase()))]);
    this.renderEditTaskSteps();
    if (btn) { btn.disabled = false; btn.textContent = '✨ Sugerir'; }
  },
});

// Los desplegables «⋯» (details.task-tools) se cierran al pulsar fuera de ellos
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('click', e => {
    document.querySelectorAll('details.task-tools[open]').forEach(d => {
      if (!d.contains(e.target)) d.removeAttribute('open');
    });
  });
}
