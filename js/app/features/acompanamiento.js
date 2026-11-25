'use strict';
// Foco acompañado y rutinas (Fases 11-14). La lógica está en js/foco-core.js.
//   11. Acompañamiento ("body doubling"): cada N minutos de foco pregunta si sigues con ello,
//       y a los 90 minutos seguidos sugiere parar un momento.
//   12. Estimaciones aprendidas: compara lo estimado con lo que tardaste y lo dice en "Ahora".
//   13. Cierre del día en 60 segundos: qué hiciste, qué queda abierto y qué es lo primero mañana.
//   14. Revisión semanal guiada: lo hecho, lo que falta por ordenar y el foco de la semana.
// Todo se guarda en este dispositivo (no se sincroniza). Métodos de NexusHiveBrainApp.

defineAppMethods({

  // ---------------- Hoja inferior genérica (sin el prefijo "modal-": closeAllModals no la toca) ----------------
  abrirHoja(id, contenido, etiqueta) {
    let hoja = document.getElementById(id);
    if (!hoja) {
      hoja = document.createElement('div');
      hoja.id = id;
      hoja.className = 'fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4';
      hoja.setAttribute('role', 'dialog');
      hoja.setAttribute('aria-modal', 'true');
      hoja.addEventListener('click', ev => { if (ev.target === hoja) this.cerrarHoja(id); });
      hoja.addEventListener('keydown', ev => { if (ev.key === 'Escape') this.cerrarHoja(id); });
      document.body.appendChild(hoja);
    }
    hoja.setAttribute('aria-label', etiqueta);
    hoja.innerHTML = html`<div class="w-full sm:max-w-lg max-h-[92dvh] flex flex-col rounded-t-3xl sm:rounded-3xl theme-card border shadow-2xl">${contenido}</div>`;
    return hoja;
  },

  cerrarHoja(id) {
    document.getElementById(id)?.remove();
  },

  // ---------------- 11. Acompañamiento ----------------
  checkInMinutes() {
    const min = Number(this.state.settings?.checkInMinutes);
    return [10, 15, 25].includes(min) ? min : 0;
  },

  setCheckInMinutes(min) {
    if (!this.state.settings) this.state.settings = {};
    this.state.settings.checkInMinutes = [10, 15, 25].includes(Number(min)) ? Number(min) : 0;
    this.saveState();
    if (this.currentView === 'ahora') this.render();
    this.showToast(this.state.settings.checkInMinutes
      ? `👥 Te preguntaré cada ${this.state.settings.checkInMinutes} min si sigues con ello.`
      : '👥 Acompañamiento apagado.');
  },

  // Lo llama el temporizador en cada tick mientras corre (js/app/features/temporizador.js)
  focoTick() {
    const r = FocoCore.tick(this._foco, Date.now(), { checkInMin: this.checkInMinutes() });
    this._foco = r.estado;
    // Tiempo de foco de la tarea propuesta en "Ahora": con él se aprenden las estimaciones
    if (this._ahoraTask && r.delta) {
      if (!this._focoTarea || this._focoTarea.id !== this._ahoraTask.id) this._focoTarea = { id: this._ahoraTask.id, ms: 0 };
      this._focoTarea.ms += r.delta;
    }
    if (r.aviso === 'checkin') this.mostrarCheckIn();
    if (r.aviso === 'hiperfoco') this.mostrarAvisoHiperfoco();
  },

  avisoDeFoco(titulo, cuerpo, tag) {
    if (this.state.settings?.vibration && 'vibrate' in navigator) {
      try { navigator.vibrate([30, 60, 30]); } catch (e) {}
    }
    // Con la app en otra pestaña o minimizada, el aviso tiene que llegar igual
    if (document.hidden) this.sendSystemNotification(titulo, { body: cuerpo, tag }).catch(() => {});
  },

  mostrarCheckIn() {
    const tarea = this._ahoraTask?.title ? `«${this._ahoraTask.title.slice(0, 60)}»` : 'lo que estabas haciendo';
    this.avisoDeFoco('👋 ¿Sigues con ello?', `¿Sigues con ${tarea}?`, 'nexus-checkin');
    this.showToast(`👋 ¿Sigues con ${tarea}?`, () => this.registrarDistraccion(), 'Me distraje');
  },

  registrarDistraccion() {
    if (!Array.isArray(this.state.focusDistractions)) this.state.focusDistractions = [];
    this.state.focusDistractions.push({ at: new Date().toISOString() });
    if (this.state.focusDistractions.length > 300) this.state.focusDistractions = this.state.focusDistractions.slice(-300);
    this.saveState();
    this.showToast('Apuntado, sin culpa: darte cuenta ya es volver. Dos minutos más y decides.');
  },

  mostrarAvisoHiperfoco() {
    const texto = `Llevas ${FocoCore.HIPERFOCO_MIN} minutos seguidos. Agua, estirar y comer algo; el temporizador sigue.`;
    this.avisoDeFoco('🧘 Un momento para ti', texto, 'nexus-hiperfoco');
    this.showToast(`🧘 ${texto}`);
  },

  // ---------------- 12. Estimaciones aprendidas ----------------
  // Se pinta bajo el título de la tarea en "Ahora" y deja anotada qué tarea se está proponiendo
  renderEstimacion(tarea) {
    this._ahoraTask = tarea && tarea.id ? { id: tarea.id, title: tarea.title, effort: tarea.effort } : null;
    const estimado = tarea ? NexusAhora.EFFORT_MINUTES[tarea.effort] : 0;
    if (!estimado) return '';
    const real = FocoCore.ajustada(estimado, FocoCore.factor(this.state.estimaciones, tarea.effort));
    return String(html`<span class="mt-1.5 text-xs font-mono text-slate-400">⏱ ~${estimado} min${real
      ? html` <span class="text-amber-300" title="Según lo que tardaste en tareas de este tamaño">· sueles tardar ~${real}</span>` : ''}</span>`);
  },

  // Al terminar una tarea: guarda cuánto foco llevó frente a lo estimado
  registrarEstimacion(tarea) {
    const foco = this._focoTarea;
    this._focoTarea = null;
    const estimado = tarea ? NexusAhora.EFFORT_MINUTES[tarea.effort] : 0;
    if (!foco || !tarea || foco.id !== tarea.id || !estimado || foco.ms < 60000) return;
    if (!Array.isArray(this.state.estimaciones)) this.state.estimaciones = [];
    this.state.estimaciones.push({ effort: tarea.effort, estimado, real: Math.round(foco.ms / 60000), at: new Date().toISOString() });
    if (this.state.estimaciones.length > 200) this.state.estimaciones = this.state.estimaciones.slice(-200);
  },

  // ---------------- Barra de rutinas al pie de "Ahora" ----------------
  renderRutinasBar() {
    const activo = this.checkInMinutes();
    const opcion = (min, texto) => html`<button type="button" data-on-click="${accion('setCheckInMinutes', min)}" aria-pressed="${String(activo === min)}"
      class="min-h-[40px] px-3 rounded-full text-xs font-semibold border transition ${activo === min
        ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-200' : 'border-slate-800 text-slate-400 hover:text-slate-200'}">${texto}</button>`;
    const rutina = (metodo, texto) => html`<button type="button" data-on-click="${accion(metodo)}"
      class="flex-1 min-h-[44px] px-3 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-300 text-xs font-semibold transition">${texto}</button>`;
    return String(html`
      <section class="pt-2 space-y-2 border-t border-slate-800/70">
        <div class="flex items-center justify-center gap-1.5 flex-wrap" role="group" aria-label="Acompañamiento durante el foco">
          <span class="text-[11px] text-slate-500" title="Durante el foco te pregunto si sigues con ello">👥 Preguntarme si sigo:</span>
          ${opcion(0, 'No')}${opcion(10, '10 min')}${opcion(15, '15 min')}${opcion(25, '25 min')}
        </div>
        <div class="flex gap-2">
          ${rutina('abrirCierreDia', '🌙 Cerrar el día')}
          ${rutina('abrirRevisionSemanal', '📅 Revisión semanal')}
        </div>
      </section>`);
  },

  // ---------------- 13. Cierre del día ----------------
  cierreDeHoy() {
    const hoy = FocoCore.claveDia(Date.now());
    return (this.state.cierres || []).find(c => c && c.date === hoy) || null;
  },

  primeroDeHoy() {
    return FocoCore.primeroDeHoy(this.state.cierres, Date.now());
  },

  abrirCierreDia() {
    const previo = this.cierreDeHoy() || {};
    const inicio = new Date();
    inicio.setHours(0, 0, 0, 0);
    const minutos = (this.state.focusSessions || []).filter(s => new Date(s.at).getTime() >= inicio.getTime()).reduce((n, s) => n + (s.minutes || 0), 0);
    const hechas = [];
    (this.state.projects || []).filter(p => !p.inBaul).forEach(p => (p.tasks || []).forEach(t => {
      if (t.column === 'victorias' && new Date(t.updatedAt).getTime() >= inicio.getTime()) hechas.push(t.title);
    }));
    const resumen = [minutos ? `${minutos} min de foco` : '', hechas.length ? `${hechas.length} ${hechas.length === 1 ? 'tarea cerrada' : 'tareas cerradas'}` : ''].filter(Boolean).join(' · ');
    const campo = (id, pregunta, valor, ejemplo) => html`
      <label class="block">
        <span class="block text-sm font-semibold mb-1">${pregunta}</span>
        <textarea id="${id}" rows="2" maxlength="500" placeholder="${ejemplo}"
          class="w-full px-3 py-2 rounded-xl bg-transparent border theme-border text-sm outline-none focus:border-cyan-500 resize-none">${valor || ''}</textarea>
      </label>`;
    this.abrirHoja('cierre-dia', html`
      <div class="px-5 pt-5">
        <h2 class="font-display font-bold text-lg">🌙 Cerrar el día</h2>
        <p class="text-xs text-slate-400 mt-1">Un minuto. Sirve para soltar el día y no empezar mañana en blanco.</p>
        ${resumen ? html`<p class="mt-2 text-xs text-emerald-300">Hoy: ${resumen}.</p>` : ''}
      </div>
      <div class="flex-1 overflow-y-auto px-5 py-3 space-y-3">
        ${campo('cierre-hecho', '1. ¿Qué hiciste hoy?', previo.hecho || hechas.slice(0, 5).join(', '), 'Aunque sea pequeño')}
        ${campo('cierre-abierto', '2. ¿Qué queda abierto?', previo.abierto, 'Lo que te ronda la cabeza')}
        ${campo('cierre-manana', '3. ¿Qué es lo primero mañana?', previo.manana, 'Una sola cosa, concreta')}
      </div>
      <div class="px-5 pb-5 pt-2 flex justify-end gap-2">
        <button type="button" data-on-click="${accion('cerrarHoja', 'cierre-dia')}" class="min-h-[44px] px-4 rounded-xl text-sm font-semibold opacity-80 hover:opacity-100">Ahora no</button>
        <button type="button" data-on-click="${accion('guardarCierreDia')}" class="min-h-[44px] px-5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-sm font-bold">Cerrar el día</button>
      </div>`, 'Cerrar el día');
    setTimeout(() => document.getElementById(previo.hecho || hechas.length ? 'cierre-abierto' : 'cierre-hecho')?.focus(), 50);
  },

  guardarCierreDia() {
    const leer = id => String(/** @type {HTMLTextAreaElement|null} */ (document.getElementById(id))?.value || '').trim().slice(0, 500);
    const cierre = { date: FocoCore.claveDia(Date.now()), hecho: leer('cierre-hecho'), abierto: leer('cierre-abierto'), manana: leer('cierre-manana'), at: new Date().toISOString() };
    this.cerrarHoja('cierre-dia');
    if (!cierre.hecho && !cierre.abierto && !cierre.manana) return;
    this.state.cierres = [...(this.state.cierres || []).filter(c => c && c.date !== cierre.date), cierre].slice(-60);
    this.saveState();
    this.showToast(cierre.manana ? `🌙 Día cerrado. Mañana empiezas por: ${cierre.manana.slice(0, 80)}` : '🌙 Día cerrado. Descansa.');
  },

  // ---------------- 14. Revisión semanal ----------------
  semanaActual() {
    const clave = FocoCore.claveSemana(Date.now());
    return this.state.semana && this.state.semana.week === clave ? this.state.semana : null;
  },

  abrirRevisionSemanal() {
    const r = FocoCore.resumenSemana(this.state, Date.now());
    const hecho = [
      r.minutosFoco ? `${r.minutosFoco} min de foco` : '',
      r.victorias.length ? `${r.victorias.length} ${r.victorias.length === 1 ? 'tarea cerrada' : 'tareas cerradas'}` : '',
      r.tachados ? `${r.tachados} ${r.tachados === 1 ? 'pendiente tachado' : 'pendientes tachados'} en tus listas` : '',
      r.cierres ? `${r.cierres} ${r.cierres === 1 ? 'día cerrado' : 'días cerrados'}` : '',
      r.distracciones ? `${r.distracciones} ${r.distracciones === 1 ? 'vez' : 'veces'} que notaste la distracción y volviste` : ''
    ].filter(Boolean);
    const paso = (n, titulo, cuerpo) => html`
      <section class="space-y-2">
        <h3 class="text-xs font-mono font-bold uppercase tracking-wider text-slate-400">${n}. ${titulo}</h3>
        ${cuerpo}
      </section>`;
    const boton = (act, texto, fuerte) => html`<button type="button" data-on-click="${act}"
      class="min-h-[40px] px-3 rounded-xl text-xs font-semibold transition ${fuerte ? 'bg-cyan-500 hover:bg-cyan-400 text-slate-950' : 'theme-card-subtle border theme-border'}">${texto}</button>`;

    this.abrirHoja('revision-semanal', html`
      <div class="px-5 pt-5">
        <h2 class="font-display font-bold text-lg">📅 Revisión de la semana</h2>
        <p class="text-xs text-slate-400 mt-1">Diez minutos. Cuatro pasos, de arriba abajo.</p>
      </div>
      <div class="flex-1 overflow-y-auto px-5 py-3 space-y-5">
        ${paso(1, 'Lo que hiciste', hecho.length ? html`
          <ul class="text-sm space-y-1">${hecho.map(h => html`<li>✓ ${h}</li>`)}</ul>
          ${r.victorias.length ? html`<p class="text-xs text-slate-400">${r.victorias.slice(0, 8).map(v => v.title).join(' · ')}</p>` : ''}`
          : html`<p class="text-sm text-slate-400">Semana tranquila en la app. También cuenta haber llegado hasta aquí.</p>`)}

        ${paso(2, 'Vaciar la cabeza', r.sinClasificar ? html`
          <p class="text-sm">Hay ${r.sinClasificar} ${r.sinClasificar === 1 ? 'pensamiento' : 'pensamientos'} sin ordenar.</p>
          ${boton(accion('revisionRepasar'), '🧹 Ordenarlos ahora', true)}`
          : html`<p class="text-sm text-slate-400">Nada sin ordenar. Mente despejada.</p>`)}

        ${paso(3, 'Proyectos quietos', r.quietos.length ? r.quietos.slice(0, 4).map(q => html`
          <div class="flex items-center justify-between gap-2 p-2.5 rounded-xl theme-card-subtle border theme-border">
            <p class="min-w-0 text-sm truncate">${q.emoji || '🎯'} ${q.name} <span class="text-xs text-slate-400">· ${q.dias} días</span></p>
            <div class="flex gap-1.5 shrink-0">
              ${boton(accion('revisionProyecto', 'seguir', q.id), 'Lo sigo')}
              ${boton(accion('revisionProyecto', 'pausar', q.id), 'Pausar sin culpa')}
            </div>
          </div>`)
          : html`<p class="text-sm text-slate-400">Ninguno lleva más de dos semanas parado.</p>`)}

        ${paso(4, 'Tu foco para esta semana', html`
          <textarea id="revision-focos" rows="3" maxlength="400" placeholder="De una a tres cosas. Lo demás puede esperar."
            class="w-full px-3 py-2 rounded-xl bg-transparent border theme-border text-sm outline-none focus:border-cyan-500 resize-none">${this.semanaActual()?.focos || ''}</textarea>`)}
      </div>
      <div class="px-5 pb-5 pt-2 flex justify-end gap-2">
        <button type="button" data-on-click="${accion('cerrarHoja', 'revision-semanal')}" class="min-h-[44px] px-4 rounded-xl text-sm font-semibold opacity-80 hover:opacity-100">Ahora no</button>
        <button type="button" data-on-click="${accion('guardarRevisionSemanal')}" class="min-h-[44px] px-5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-sm font-bold">Listo</button>
      </div>`, 'Revisión de la semana');
  },

  // Lo escrito en el paso 4 no se pierde al repintar la hoja o al salir a ordenar pensamientos
  guardarFocosSemana() {
    const campo = /** @type {HTMLTextAreaElement|null} */ (document.getElementById('revision-focos'));
    if (!campo) return;
    this.state.semana = { week: FocoCore.claveSemana(Date.now()), focos: campo.value.trim().slice(0, 400), at: new Date().toISOString() };
    this.saveState();
  },

  revisionRepasar() {
    this.guardarFocosSemana();
    this.cerrarHoja('revision-semanal');
    this.startQuickReview();
  },

  revisionProyecto(decision, projectId) {
    this.guardarFocosSemana();
    if (decision === 'pausar') this.hibernateProjectWithoutGuilt(projectId);
    else this.dismissStalledProject(projectId);
    this.abrirRevisionSemanal();
  },

  guardarRevisionSemanal() {
    this.guardarFocosSemana();
    this.cerrarHoja('revision-semanal');
    const focos = this.semanaActual()?.focos;
    this.showToast(focos ? '📅 Semana revisada. Tu foco queda en el resumen de cada mañana.' : '📅 Semana revisada.');
  },

  // ---------------- Recordatorios suaves (una vez, sin insistir) ----------------
  // Al abrir la app: por la tarde, cerrar el día; de viernes a domingo, la revisión semanal.
  ofrecerRutinas() {
    const ahora = new Date();
    const leer = clave => { try { return localStorage.getItem(clave); } catch (e) { return null; } };
    const marcar = (clave, valor) => { try { localStorage.setItem(clave, valor); } catch (e) {} };
    const hoy = FocoCore.claveDia(ahora.getTime());
    const semana = FocoCore.claveSemana(ahora.getTime());
    const dia = ahora.getDay(); // 0 domingo … 5 viernes, 6 sábado

    if ((dia === 5 || dia === 6 || dia === 0) && !this.semanaActual() && leer('nexus_revision_ofrecida') !== semana) {
      marcar('nexus_revision_ofrecida', semana);
      this.showToast('📅 ¿Repasamos la semana? Son diez minutos.', () => this.abrirRevisionSemanal(), 'Empezar');
      return;
    }
    const inicio = new Date(ahora);
    inicio.setHours(0, 0, 0, 0);
    const huboFoco = (this.state.focusSessions || []).some(s => new Date(s.at).getTime() >= inicio.getTime());
    if (ahora.getHours() >= 18 && huboFoco && !this.cierreDeHoy() && leer('nexus_cierre_ofrecido') !== hoy) {
      marcar('nexus_cierre_ofrecido', hoy);
      this.showToast('🌙 ¿Cerramos el día? Un minuto.', () => this.abrirCierreDia(), 'Cerrar');
    }
  },
});
