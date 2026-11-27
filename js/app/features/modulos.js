'use strict';
// Módulos opcionales (Fase 21): datos, sincronización, fichas de Repasar y lo que aportan a «Ahora».
// El registro y la mezcla entre dispositivos están en js/modulos-core.js; cada módulo, en js/app/modulos/.
// Los datos viven en this.state.modulos = { habits: [], people: [], expenses: [], energy: [] }.
// Métodos de NexusHiveBrainApp (la clase base está en js/app.js).

defineAppMethods({

  // ---------------- Datos ----------------
  modDocs(coleccion) {
    if (!this.state.modulos || typeof this.state.modulos !== 'object') this.state.modulos = {};
    if (!Array.isArray(this.state.modulos[coleccion])) this.state.modulos[coleccion] = [];
    return this.state.modulos[coleccion];
  },

  modVivos(coleccion) {
    return ModulosCore.vivos(this.modDocs(coleccion));
  },

  // Crea o sustituye el documento. Siempre con fecha de ahora: es la versión que gana al sincronizar.
  modGuardar(coleccion, doc) {
    if (!doc || !doc.id) return null;
    const docs = this.modDocs(coleccion);
    const guardado = { ...doc, updatedAt: new Date().toISOString() };
    const i = docs.findIndex(d => d && d.id === doc.id);
    if (i >= 0) docs[i] = guardado; else docs.push(guardado);
    this.saveState();
    return guardado;
  },

  // Borrar deja una marca (deleted) para que otro dispositivo no lo resucite
  modBorrar(coleccion, id) {
    const docs = this.modDocs(coleccion);
    const i = docs.findIndex(d => d && d.id === id);
    if (i < 0) return;
    const ahora = new Date().toISOString();
    docs[i] = { id, deleted: true, createdAt: docs[i].createdAt, updatedAt: ahora };
    this.saveState();
  },

  // ---------------- Sincronización (las llama js/app.js) ----------------
  mezclarModulosRemotos(data) {
    if (!data || !data.modulos || typeof data.modulos !== 'object') return;
    this.state.modulos = ModulosCore.mezclarEstado(this.state.modulos, data.modulos);
  },

  cambiosDeModulos(desdeMs) {
    return ModulosCore.cambiados(this.state.modulos, desdeMs);
  },

  // ---------------- Encender y apagar ----------------
  moduloActivo(id) {
    return ModulosCore.activo(this.state.settings, id);
  },

  setModuloActivo(id, on) {
    const modulo = ModulosCore.porId(id);
    if (!modulo) return;
    if (!this.state.settings) this.state.settings = {};
    this.state.settings.modulos = { ...(this.state.settings.modulos || {}), [id]: !!on };
    this.saveState();
    // Apagar un módulo no borra sus datos: solo deja de verse
    if (!on && this.currentView === modulo.vista) { this.navigate('mas'); return; }
    this.render();
    this.showToast(on ? `${modulo.icono} ${modulo.nombre} encendido: tiene su ficha en Repasar.` : `${modulo.nombre} apagado. Sus datos se conservan.`);
  },

  // Fichas de Repasar de los módulos encendidos (js/app/views/repasar.js)
  fichasDeModulos() {
    return ModulosCore.activos(this.state.settings).filter(m => m.render).map(m => ({ view: m.vista, icon: m.icono, label: m.nombre }));
  },

  tituloModulo(vista) {
    const m = ModulosCore.porVista(vista);
    return m ? `${m.icono} ${m.nombre}` : '';
  },

  // Pinta la ficha del módulo de la vista actual. Devuelve false si la vista no es de un módulo.
  renderVistaModulo(container) {
    const m = ModulosCore.porVista(this.currentView);
    if (!m || !container) return false;
    if (!this.moduloActivo(m.id) || typeof this[m.render] !== 'function') {
      container.innerHTML = html`
        <div class="max-w-md mx-auto p-6 text-center rounded-3xl theme-card border theme-border space-y-3 my-6">
          <p class="text-3xl" aria-hidden="true">${m.icono}</p>
          <h2 class="font-display font-bold text-lg">${m.nombre}</h2>
          <p class="text-xs theme-text-muted">${m.descripcion}</p>
          <button type="button" data-on-click="${accion('setModuloActivo', m.id, true)}" class="min-h-[44px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold">Encender este módulo</button>
        </div>`;
      return true;
    }
    this[m.render](container);
    return true;
  },

  // Tarjeta de Ajustes: un interruptor por módulo (js/app/views/mas.js)
  renderModulosAjustes() {
    const modulos = ModulosCore.lista();
    if (!modulos.length) return '';
    return String(html`
      <section class="p-4 sm:p-5 rounded-3xl theme-card border theme-border space-y-3" aria-label="Módulos">
        <div>
          <h3 class="font-display font-bold text-base">🧩 Módulos</h3>
          <p class="text-xs theme-text-muted mt-1">Enciende solo lo que uses. Cada uno añade una ficha a Repasar, nunca una pantalla principal.</p>
        </div>
        ${modulos.map(m => html`
          <label class="flex items-center gap-3 p-3 rounded-2xl theme-card-subtle border theme-border cursor-pointer">
            <span class="text-2xl" aria-hidden="true">${m.icono}</span>
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-semibold">${m.nombre}</span>
              <span class="block text-[11px] theme-text-muted">${m.descripcion}</span>
            </span>
            <input type="checkbox" ${this.moduloActivo(m.id) ? raw('checked') : ''} data-on-change="${accion('setModuloActivo', m.id, '$checked')}" class="w-5 h-5 shrink-0 accent-emerald-500" aria-label="${m.nombre}" />
          </label>`)}
      </section>`);
  },

  // ---------------- «Ahora»: una sola sugerencia de los módulos ----------------
  candidatoDeModulos() {
    return ModulosCore.candidatos(this.state.settings, this.state.modulos, Date.now())[0] || null;
  },

  renderCandidatoModulos() {
    const c = this.candidatoDeModulos();
    if (!c) return '';
    return String(html`
      <div class="flex items-center justify-between gap-2 px-3 py-2 rounded-2xl theme-card-subtle border theme-border text-left">
        <p class="min-w-0 text-xs truncate"><span class="theme-text-muted">También hoy:</span> ${c.texto}</p>
        ${Array.isArray(c.accion) ? html`<button type="button" data-on-click="${accion(...c.accion)}" class="min-h-[36px] px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shrink-0">${c.boton || 'Hecho'}</button>` : ''}
      </div>`);
  },

  // Líneas de los módulos para el resumen de la mañana (js/app/features/jarvis.js)
  resumenDeModulos() {
    return ModulosCore.resumenes(this.state.settings, this.state.modulos, Date.now());
  },
});
