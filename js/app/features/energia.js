'use strict';
// Energía del día (Fases 17-19). La lógica está en js/energia-core.js y js/foco-core.js.
//   17. Medidor: la energía de hoy da una capacidad; lo que está En foco o tiene fecha la gasta.
//   18. «¿Qué cabe ahora?»: «Ahora» propone primero lo que cabe en la energía que queda.
//   19. Incubadora: lo que lleva 14 días sin tocarse pasa a «Más tarde» y se revisa el fin de semana.
// La energía se guarda una vez al día y se sincroniza (colección «energy» de los módulos).
// Métodos de NexusHiveBrainApp (la clase base está en js/app.js).

defineAppMethods({

  // ---------------- 17. Medidor ----------------
  // La energía que la persona dijo hoy (en este u otro dispositivo), o null si aún no ha dicho nada
  energiaGuardadaHoy() {
    return EnergiaCore.nivelDe(this.modDocs('energy'), FocoCore.claveDia(Date.now()));
  },

  // Lo llama setEnergyToday (js/app/views/ahora-hoy.js)
  guardarEnergiaDia(nivel) {
    const doc = EnergiaCore.docEnergia(FocoCore.claveDia(Date.now()), nivel);
    this.modGuardar('energy', doc);
    // Solo hacen falta los últimos días: lo más viejo se suelta en este dispositivo
    const docs = this.modDocs('energy');
    if (docs.length > 60) this.state.modulos.energy = docs.slice().sort((a, b) => (a.id < b.id ? 1 : -1)).slice(0, 45);
  },

  medidorEnergia() {
    const hoy = EnergiaCore.tareasDeHoy(this.state.projects, this.endOfToday());
    return { ...EnergiaCore.medidor(hoy, this.getEnergyToday()), tareas: hoy };
  },

  renderMedidorEnergia() {
    const m = this.medidorEnergia();
    if (!m.tareas.length) return '';
    const texto = m.pasado
      ? `Hoy llevas ${m.carga} de ${m.capacidad} puntos de energía.`
      : `${m.carga} de ${m.capacidad} puntos de energía usados hoy.`;
    return String(html`
      <div class="w-full max-w-md mx-auto space-y-1" role="group" aria-label="Energía de hoy">
        <div class="h-1.5 rounded-full bg-slate-500/20 overflow-hidden" role="progressbar" aria-valuemin="0" aria-valuemax="${m.capacidad}" aria-valuenow="${Math.min(m.carga, m.capacidad)}" aria-label="Energía usada">
          <span class="block h-full ${m.pasado ? 'bg-amber-400' : 'bg-cyan-500'}" style="width:${m.pct}%"></span>
        </div>
        <p class="text-[11px] ${m.pasado ? 'text-amber-300' : 'text-slate-500'}">${texto}
          ${m.pasado ? html`<button type="button" data-on-click="${accion('abrirAligerarHoy')}" class="underline font-semibold">¿Mover algo a mañana?</button>` : ''}</p>
      </div>`);
  },

  // Hoja para aligerar el día: cada tarea de hoy con «Mañana» (fecha) o «Sacar del foco»
  abrirAligerarHoy() {
    const m = this.medidorEnergia();
    const fila = x => html`
      <div class="flex items-center justify-between gap-2 p-2.5 rounded-xl theme-card-subtle border theme-border">
        <div class="min-w-0">
          <p class="text-sm font-semibold truncate">${x.task.title}</p>
          <p class="text-[11px] theme-text-muted">${x.project} · ${x.peso} ${x.peso === 1 ? 'punto' : 'puntos'}</p>
        </div>
        <button type="button" data-on-click="${accion('aligerarTarea', x.projectId, x.task.id)}" class="min-h-[40px] px-3 rounded-xl theme-card border theme-border text-xs font-semibold shrink-0">${x.task.dueAt ? 'Mañana' : 'Sacar del foco'}</button>
      </div>`;
    this.abrirHoja('aligerar-hoy', html`
      <div class="px-5 pt-5">
        <h2 class="font-display font-bold text-lg">🔋 Aligerar el día</h2>
        <p class="text-xs theme-text-muted mt-1">${m.pasado ? `Hay ${m.carga} puntos para una energía de ${m.capacidad}. No es un fallo: es demasiado para hoy.` : 'Ya cabe en tu energía de hoy.'}</p>
      </div>
      <div class="flex-1 overflow-y-auto px-5 py-3 space-y-2">
        ${m.tareas.length ? m.tareas.slice().sort((a, b) => b.peso - a.peso).map(fila) : html`<p class="text-sm theme-text-muted">Nada para hoy.</p>`}
      </div>
      <div class="px-5 pb-5 pt-2 flex justify-end">
        <button type="button" data-on-click="${accion('cerrarHoja', 'aligerar-hoy')}" class="min-h-[44px] px-5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-sm font-bold">Listo</button>
      </div>`, 'Aligerar el día');
  },

  // Con fecha: pasa a mañana a las 9:00. En foco sin fecha: vuelve a «Próximo».
  aligerarTarea(projectId, taskId) {
    const found = this._tareaPorId(projectId, taskId);
    if (!found) return;
    const { project, task } = found;
    if (task.dueAt) {
      this.snoozeDueItem('task', taskId, projectId);
    } else {
      task.column = 'proximo';
      task.updatedAt = project.updatedAt = new Date().toISOString();
      this.saveState();
      this.render();
    }
    this.abrirAligerarHoy();
  },

  // ---------------- 18. ¿Qué cabe ahora? ----------------
  // Reordena las candidatas de «Ahora»: primero las que caben en la energía que queda hoy
  ordenarPorEnergia(candidatas) {
    const m = this.medidorEnergia();
    return EnergiaCore.ordenarPorCabida(candidatas, m.restante, new Set(m.tareas.map(x => x.task.id)));
  },

  // Texto bajo el título de la tarea propuesta
  renderCabida(tarea) {
    if (!tarea || !tarea.id || tarea.id === 'task-temp') return '';
    const m = this.medidorEnergia();
    if (m.tareas.some(x => x.task.id === tarea.id) || EnergiaCore.cabe(tarea, m.restante)) return '';
    return String(html`<p class="mt-1 text-[11px] text-amber-300">Es grande para la energía que te queda hoy. Prueba «↻ Otra» o solo su primer paso.</p>`);
  },

  // ---------------- 19. Incubadora automática ----------------
  // Una vez al día, al abrir la app. Mueve a «Más tarde» lo que lleva 14 días sin tocarse y lo dice una vez.
  incubarAutomatico() {
    const hoy = FocoCore.claveDia(Date.now());
    try {
      if (localStorage.getItem('nexus_incubadora_dia') === hoy) return [];
      localStorage.setItem('nexus_incubadora_dia', hoy);
    } catch (e) { return []; }
    const lista = FocoCore.incubables(this.state.projects, Date.now());
    if (!lista.length) return [];
    const ahora = new Date().toISOString();
    for (const x of lista) {
      const found = this._tareaPorId(x.projectId, x.taskId);
      if (!found) continue;
      found.task.incubatedFrom = found.task.column;
      found.task.incubatedAt = ahora;
      found.task.column = 'congelador';
      found.task.updatedAt = found.project.updatedAt = ahora;
    }
    this.saveState();
    if (this.currentView) this.render();
    this.showToast(`🥚 ${lista.length === 1 ? '1 tarea llevaba' : `${lista.length} tareas llevaban`} dos semanas sin tocarse: ${lista.length === 1 ? 'está' : 'están'} en «Más tarde». Las vemos en la revisión semanal.`,
      () => lista.forEach(x => this.rescatarIncubada(x.projectId, x.taskId, true)), 'Deshacer');
    return lista;
  },

  // Vuelve a la columna de la que salió. Se usa desde el aviso y desde la revisión semanal.
  rescatarIncubada(projectId, taskId, silencioso = false) {
    const found = this._tareaPorId(projectId, taskId);
    if (!found || found.task.column !== 'congelador') return;
    const { project, task } = found;
    task.column = task.incubatedFrom === 'proximo' ? 'proximo' : 'buzon';
    delete task.incubatedFrom;
    delete task.incubatedAt;
    task.updatedAt = project.updatedAt = new Date().toISOString();
    this.saveState();
    if (silencioso === true) { if (this.currentView) this.render(); return; }
    if (document.getElementById('revision-semanal')) { this.guardarFocosSemana(); this.abrirRevisionSemanal(); }
    this.showToast(`↩️ De vuelta en tus tareas: ${task.title}`);
  },

  // «Soltarla»: se queda en Más tarde, pero deja de salir en la revisión
  soltarIncubada(projectId, taskId) {
    const found = this._tareaPorId(projectId, taskId);
    if (!found) return;
    delete found.task.incubatedAt;
    delete found.task.incubatedFrom;
    found.task.updatedAt = found.project.updatedAt = new Date().toISOString();
    this.saveState();
    if (document.getElementById('revision-semanal')) { this.guardarFocosSemana(); this.abrirRevisionSemanal(); }
  },

  // Paso de la revisión semanal (js/app/features/acompanamiento.js)
  renderIncubadoraRevision() {
    const lista = FocoCore.incubadas(this.state.projects);
    if (!lista.length) return html`<p class="text-sm text-slate-400">Nada esperando en «Más tarde».</p>`;
    return html`
      <p class="text-xs text-slate-400">Llevaban dos semanas sin tocarse. Decide sin culpa: vuelve o se queda fuera de la vista.</p>
      ${lista.slice(0, 6).map(x => html`
        <div class="flex items-center justify-between gap-2 p-2.5 rounded-xl theme-card-subtle border theme-border">
          <p class="min-w-0 text-sm truncate">${x.title} <span class="text-xs text-slate-400">· ${x.project}</span></p>
          <div class="flex gap-1.5 shrink-0">
            <button type="button" data-on-click="${accion('rescatarIncubada', x.projectId, x.taskId)}" class="min-h-[40px] px-3 rounded-xl text-xs font-semibold theme-card-subtle border theme-border">La retomo</button>
            <button type="button" data-on-click="${accion('soltarIncubada', x.projectId, x.taskId)}" class="min-h-[40px] px-3 rounded-xl text-xs font-semibold theme-card-subtle border theme-border">Más tarde</button>
          </div>
        </div>`)}
      ${lista.length > 6 ? html`<p class="text-xs text-slate-400">y ${lista.length - 6} más en Repasar → Tareas → Congelador.</p>` : ''}`;
  },
});
