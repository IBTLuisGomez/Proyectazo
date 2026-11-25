'use strict';
// Ficha "Listas" de Repasar: listas de pendientes y notas al estilo de Google Keep
// (tarjetas de colores, casillas, fijar, archivar, buscar) y el enlace con los widgets de Android.
// El modelo y la mezcla entre dispositivos están en js/notas-core.js.
// Métodos de NexusHiveBrainApp (la clase base está en js/app.js).

defineAppMethods({

  // ---------------- Datos ----------------
  listaNotas() {
    if (!Array.isArray(this.state.notas)) this.state.notas = [];
    return this.state.notas;
  },

  buscarNota(id) {
    return this.listaNotas().find(n => n.id === id && !n.deleted) || null;
  },

  // Todo cambio pasa por aquí: fecha la nota, guarda (agrupando las pulsaciones al escribir),
  // avisa al widget y programa el envío al servidor.
  notaCambiada(nota, opciones = {}) {
    const now = new Date().toISOString();
    nota.updatedAt = now;
    if (opciones.meta) nota.metaAt = now;
    if (opciones.alEscribir) {
      clearTimeout(this._notasGuardarTimer);
      this._notasGuardarTimer = setTimeout(() => this.guardarNotas(), 500);
    } else {
      this.guardarNotas();
    }
  },

  guardarNotas() {
    clearTimeout(this._notasGuardarTimer);
    this._notasGuardarTimer = null;
    this.saveState();
    this.publicarNotasEnWidget();
    clearTimeout(this._notasSyncTimer);
    this._notasSyncTimer = setTimeout(() => {
      if (this.backendAvailable && !this._syncing) this.syncWithBackend(false);
    }, 3000);
  },

  refrescarNotas() {
    if (this.currentView === 'notas') this.renderNotasGrid();
    if (this.notaAbiertaId) this.renderNotaEditor();
  },

  // Dentro de una tarjeta: que el clic en un botón o casilla no abra además la nota
  detenerClic(ev) {
    if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
  },

  estiloNota(nota) {
    const color = NotasCore.COLORES[nota.color] || NotasCore.COLORES.ninguno;
    return color.rgb ? `background-color: rgba(${color.rgb}, 0.16); border-color: rgba(${color.rgb}, 0.55);` : '';
  },

  // ---------------- Vista ----------------
  renderViewNotas(container) {
    const archivo = this.notasVista === 'archivo';
    const buscando = document.activeElement && document.activeElement.id === 'notas-buscar';
    const ficha = (vista, texto) => html`<button type="button" data-on-click="${accion('setNotasVista', vista)}" aria-pressed="${String((vista === 'archivo') === archivo)}"
      class="min-h-[40px] px-3.5 rounded-full text-xs font-semibold border transition ${(vista === 'archivo') === archivo
        ? 'bg-cyan-500/15 border-cyan-500/50 text-cyan-200' : 'border-slate-800 text-slate-400 hover:text-slate-200'}">${texto}</button>`;

    container.innerHTML = html`
      <div class="max-w-6xl mx-auto space-y-4 py-2">
        <div class="flex flex-wrap items-end justify-between gap-3">
          <div>
            <span class="text-xs font-mono font-bold uppercase text-slate-400 tracking-wider">Repasar</span>
            <h1 class="text-2xl sm:text-3xl font-display font-extrabold text-white mt-1">📝 Listas y notas</h1>
            <p class="text-xs text-slate-400 mt-1">Compras, recados y pendientes sueltos. Marca la casilla y listo.</p>
          </div>
          <div class="flex gap-2">${ficha('activas', 'Activas')}${ficha('archivo', '📦 Archivo')}</div>
        </div>

        <div class="flex flex-col sm:flex-row gap-2 ${archivo ? 'hidden' : ''}">
          <input id="notas-nueva-titulo" type="text" maxlength="300" autocomplete="off" placeholder="Nueva lista… (escribe el nombre y pulsa Enter)"
            data-on-enter="${accion('crearNotaDesdeBarra', 'lista')}"
            class="flex-1 min-h-[44px] px-4 rounded-2xl theme-card border text-sm outline-none focus:border-cyan-500">
          <div class="flex gap-2">
            <button type="button" data-on-click="${accion('crearNotaDesdeBarra', 'lista')}"
              class="flex-1 min-h-[44px] px-4 rounded-2xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-sm font-bold transition">☑ Lista</button>
            <button type="button" data-on-click="${accion('crearNotaDesdeBarra', 'nota')}"
              class="flex-1 min-h-[44px] px-4 rounded-2xl theme-card border text-sm font-semibold hover:border-cyan-500 transition">📝 Nota</button>
          </div>
        </div>

        <input id="notas-buscar" type="search" autocomplete="off" placeholder="Buscar en listas y notas" value="${this.notasBusqueda || ''}"
          data-on-input="${accion('setNotasBusqueda', '$value')}" aria-label="Buscar en listas y notas"
          class="w-full min-h-[40px] px-4 rounded-2xl theme-card border text-sm outline-none focus:border-cyan-500">

        <div id="notas-grid"></div>
      </div>`;
    this.renderNotasGrid();
    if (buscando) {
      // Un sincronizado repinta la vista: no sacar al usuario del buscador
      const campo = /** @type {HTMLInputElement|null} */ (document.getElementById('notas-buscar'));
      if (campo) {
        campo.focus();
        campo.setSelectionRange(campo.value.length, campo.value.length);
      }
    }
  },

  renderNotasGrid() {
    const grid = document.getElementById('notas-grid');
    if (!grid) return;
    const archivo = this.notasVista === 'archivo';
    const notas = NotasCore.visibles(this.listaNotas(), { archivo, busqueda: this.notasBusqueda || '' });
    if (!notas.length) {
      const mensaje = this.notasBusqueda ? 'Nada coincide con la búsqueda.'
        : archivo ? 'El archivo está vacío.' : 'Aún no hay listas. Crea la primera arriba.';
      grid.innerHTML = html`<p class="text-center text-sm text-slate-400 py-10">${mensaje}</p>`;
      return;
    }
    const columnas = lista => html`<div class="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-3">${lista.map(n => this.renderNotaCard(n))}</div>`;
    const fijadas = notas.filter(n => n.pinned);
    const otras = notas.filter(n => !n.pinned);
    const titulo = texto => html`<h2 class="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-2">${texto}</h2>`;
    grid.innerHTML = html`
      ${fijadas.length ? html`<section class="mb-5">${titulo('📌 Fijadas')}${columnas(fijadas)}</section>` : ''}
      ${otras.length ? html`<section>${fijadas.length ? titulo('Otras') : ''}${columnas(otras)}</section>` : ''}`;
  },

  renderNotaCard(nota) {
    const MAX = 8;
    const pendientes = NotasCore.pendientes(nota);
    const hechos = NotasCore.hechos(nota);
    const filas = pendientes.slice(0, MAX).map(item => html`
      <label class="flex items-start gap-2.5 py-1 cursor-pointer" data-on-click="${accion('detenerClic', '$event')}">
        <input type="checkbox" class="mt-0.5 h-[18px] w-[18px] shrink-0 accent-cyan-500"
          data-on-change="${accion('marcarItemNota', nota.id, item.id, '$checked')}">
        <span class="text-sm leading-snug break-words min-w-0">${item.text}</span>
      </label>`);
    const resto = pendientes.length - MAX;
    const boton = (metodo, icono, etiqueta) => html`<button type="button" data-on-click="${accion(metodo, nota.id, '$event')}" title="${etiqueta}" aria-label="${etiqueta}"
      class="h-9 w-9 rounded-full flex items-center justify-center text-sm opacity-70 hover:opacity-100 hover:bg-slate-500/20 transition">${icono}</button>`;

    return html`
      <article data-on-click="${accion('abrirNota', nota.id)}" style="${this.estiloNota(nota)}"
        class="break-inside-avoid mb-3 p-4 rounded-2xl theme-card border cursor-pointer hover:shadow-lg transition">
        <div class="flex items-start gap-2">
          <h3 class="flex-1 min-w-0 font-display font-bold text-base break-words">${nota.title || (nota.kind === 'lista' ? 'Lista sin título' : '')}</h3>
          ${boton('fijarNota', nota.pinned ? '📌' : '📍', nota.pinned ? 'Dejar de fijar' : 'Fijar arriba')}
        </div>
        ${nota.text ? html`<p class="mt-1 text-sm whitespace-pre-wrap break-words max-h-48 overflow-hidden">${nota.text}</p>` : ''}
        ${filas.length ? html`<div class="mt-2">${filas}</div>` : ''}
        ${resto > 0 ? html`<p class="mt-1 text-xs text-slate-400">y ${resto} más…</p>` : ''}
        ${hechos.length ? html`<p class="mt-2 text-xs text-slate-400">✓ ${hechos.length} ${hechos.length === 1 ? 'completado' : 'completados'}</p>` : ''}
        <div class="mt-2 -mb-2 -mx-1 flex items-center justify-end gap-1">
          ${boton('archivarNota', nota.archived ? '📤' : '📦', nota.archived ? 'Sacar del archivo' : 'Archivar')}
          ${boton('borrarNota', '🗑️', 'Borrar')}
        </div>
      </article>`;
  },

  setNotasVista(vista) {
    this.notasVista = vista === 'archivo' ? 'archivo' : 'activas';
    this.render();
  },

  setNotasBusqueda(texto) {
    this.notasBusqueda = String(texto || '');
    this.renderNotasGrid();
  },

  // ---------------- Crear, abrir y cerrar ----------------
  crearNotaDesdeBarra(kind) {
    const campo = /** @type {HTMLInputElement|null} */ (document.getElementById('notas-nueva-titulo'));
    const nota = NotasCore.crear({ kind, title: campo ? campo.value.trim() : '' });
    if (campo) campo.value = '';
    this.listaNotas().push(nota);
    this._notaRecienCreada = nota.id;
    this.notaCambiada(nota, { meta: true });
    this.renderNotasGrid();
    this.abrirNota(nota.id);
  },

  abrirNota(id) {
    if (!this.buscarNota(id)) return;
    this.notaAbiertaId = id;
    this.renderNotaEditor();
    // Solo al crear: en el móvil, abrir una lista para marcar algo no debe sacar el teclado
    if (this._notaRecienCreada !== id) return;
    const nota = this.buscarNota(id);
    const foco = !nota.title ? 'nota-editor-titulo' : nota.kind === 'lista' ? 'nota-item-nuevo' : 'nota-editor-texto';
    setTimeout(() => document.getElementById(foco)?.focus(), 50);
  },

  cerrarNota() {
    const id = this.notaAbiertaId;
    this.notaAbiertaId = null;
    document.getElementById('nota-editor')?.remove();
    const nota = id ? this.buscarNota(id) : null;
    // Como en Keep: una nota que se abre y se cierra vacía no se guarda
    if (nota && this._notaRecienCreada === id && NotasCore.estaVacia(nota)) {
      Object.assign(nota, { deleted: true, items: [] });
      this.notaCambiada(nota, { meta: true });
    } else if (this._notasGuardarTimer) {
      this.guardarNotas();
    }
    this._notaRecienCreada = null;
    if (this.currentView === 'notas') this.renderNotasGrid();
  },

  abrirDesdeWidget(id) {
    this.navigate('notas');
    if (id && this.buscarNota(id)) this.abrirNota(id);
  },

  // ---------------- Editor ----------------
  renderNotaEditor() {
    const nota = this.notaAbiertaId ? this.buscarNota(this.notaAbiertaId) : null;
    if (!nota) {
      this.notaAbiertaId = null;
      document.getElementById('nota-editor')?.remove();
      return;
    }
    let overlay = document.getElementById('nota-editor');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'nota-editor'; // sin el prefijo "modal-": closeAllModals() lo escondería sin guardar
      overlay.className = 'fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm sm:p-4';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Editar lista o nota');
      overlay.addEventListener('click', ev => { if (ev.target === overlay) this.cerrarNota(); });
      overlay.addEventListener('keydown', ev => { if (ev.key === 'Escape') this.cerrarNota(); });
      document.body.appendChild(overlay);
      if (!this._notaPopstate) {
        // Botón atrás de Android: cierra el editor
        this._notaPopstate = () => { if (this.notaAbiertaId) this.cerrarNota(); };
        window.addEventListener('popstate', this._notaPopstate);
      }
    }
    const id = nota.id;
    const esLista = nota.kind === 'lista';
    const pendientes = NotasCore.pendientes(nota);
    const hechos = NotasCore.hechos(nota);
    const fila = item => html`
      <div class="flex items-center gap-2.5 py-0.5">
        <input type="checkbox" ${item.done ? raw('checked') : ''} aria-label="Completar" class="h-5 w-5 shrink-0 accent-cyan-500"
          data-on-change="${accion('marcarItemNota', id, item.id, '$checked')}">
        <input type="text" value="${item.text}" maxlength="2000" aria-label="Texto del pendiente"
          data-on-change="${accion('setItemNotaTexto', id, item.id, '$value')}" data-on-enter="${accion('enfocarNuevoItemNota')}"
          class="flex-1 min-w-0 min-h-[40px] bg-transparent text-sm outline-none border-b border-transparent focus:border-cyan-500 ${item.done ? 'line-through opacity-60' : ''}">
        <button type="button" data-on-click="${accion('borrarItemNota', id, item.id)}" aria-label="Quitar pendiente" title="Quitar"
          class="h-9 w-9 shrink-0 rounded-full opacity-60 hover:opacity-100 hover:bg-slate-500/20 transition">✕</button>
      </div>`;
    const colores = Object.entries(NotasCore.COLORES).map(([clave, color]) => html`
      <button type="button" data-on-click="${accion('setNotaColor', id, clave)}" title="${color.nombre}" aria-label="Color ${color.nombre}" aria-pressed="${String((nota.color || 'ninguno') === clave)}"
        style="${color.rgb ? `background-color: rgba(${color.rgb}, 0.85);` : ''}"
        class="h-7 w-7 shrink-0 rounded-full border-2 text-xs ${(nota.color || 'ninguno') === clave ? 'border-cyan-400 scale-110' : 'border-slate-500/40'}">${color.rgb ? '' : '⦸'}</button>`);
    const accionPie = (metodo, texto) => html`<button type="button" data-on-click="${accion(metodo, id)}"
      class="min-h-[40px] px-3 rounded-xl text-xs font-semibold opacity-80 hover:opacity-100 hover:bg-slate-500/20 transition">${texto}</button>`;

    overlay.innerHTML = html`
      <div style="${this.estiloNota(nota)}" class="w-full sm:max-w-lg max-h-[92dvh] flex flex-col rounded-t-3xl sm:rounded-3xl theme-card border shadow-2xl">
        <div class="flex items-center gap-2 px-4 pt-4">
          <input id="nota-editor-titulo" type="text" value="${nota.title || ''}" maxlength="300" placeholder="Título" autocomplete="off"
            data-on-input="${accion('setNotaTitulo', id, '$value')}" data-on-enter="${accion('enfocarNuevoItemNota')}"
            class="flex-1 min-w-0 min-h-[44px] bg-transparent font-display font-bold text-lg outline-none">
          <button type="button" data-on-click="${accion('fijarNota', id)}" title="${nota.pinned ? 'Dejar de fijar' : 'Fijar arriba'}" aria-label="${nota.pinned ? 'Dejar de fijar' : 'Fijar arriba'}"
            class="h-10 w-10 shrink-0 rounded-full hover:bg-slate-500/20 transition ${nota.pinned ? '' : 'opacity-60'}">${nota.pinned ? '📌' : '📍'}</button>
        </div>

        <div class="flex-1 overflow-y-auto px-4 py-2">
          ${esLista ? html`
            ${pendientes.map(fila)}
            <div class="flex items-center gap-2.5 py-1">
              <span class="h-5 w-5 shrink-0 text-center leading-5 opacity-60" aria-hidden="true">＋</span>
              <input id="nota-item-nuevo" type="text" maxlength="2000" placeholder="Añadir pendiente" autocomplete="off" enterkeyhint="done"
                data-on-enter="${accion('agregarItemNota', id)}"
                class="flex-1 min-w-0 min-h-[44px] bg-transparent text-sm outline-none border-b border-slate-500/30 focus:border-cyan-500">
              <button type="button" data-on-click="${accion('agregarItemNota', id)}"
                class="min-h-[40px] px-3 shrink-0 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition">Añadir</button>
            </div>
            ${hechos.length ? html`
              <details class="mt-2" ${this._notaHechosAbiertos ? raw('open') : ''} data-on-click="${accion('recordarHechosNota', '$event')}">
                <summary class="cursor-pointer text-xs font-semibold text-slate-400 py-2">✓ ${hechos.length} ${hechos.length === 1 ? 'completado' : 'completados'}</summary>
                ${hechos.map(fila)}
                <button type="button" data-on-click="${accion('borrarHechosNota', id)}"
                  class="mt-1 min-h-[36px] px-3 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-500/20 transition">Quitar los completados</button>
              </details>` : ''}
          ` : html`
            <textarea id="nota-editor-texto" rows="8" maxlength="20000" placeholder="Escribe una nota…"
              data-on-input="${accion('setNotaTexto', id, '$value')}"
              class="w-full bg-transparent text-sm leading-relaxed outline-none resize-none">${nota.text || ''}</textarea>`}
        </div>

        <div class="px-4 pt-2 pb-4 border-t theme-border space-y-2">
          <div class="flex items-center gap-2 overflow-x-auto py-1" role="group" aria-label="Color">${colores}</div>
          <div class="flex flex-wrap items-center gap-1">
            ${accionPie('alternarTipoNota', esLista ? '📝 Pasar a texto' : '☑ Pasar a casillas')}
            ${accionPie('archivarNota', nota.archived ? '📤 Sacar del archivo' : '📦 Archivar')}
            ${accionPie('borrarNota', '🗑️ Borrar')}
            <button type="button" data-on-click="${accion('cerrarNota')}"
              class="ml-auto min-h-[40px] px-5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-sm font-bold transition">Listo</button>
          </div>
        </div>
      </div>`;
  },

  recordarHechosNota(ev) {
    // El editor se repinta al marcar: recordar si "completados" estaba desplegado
    if (ev && ev.target instanceof Element && ev.target.closest('summary')) {
      this._notaHechosAbiertos = !ev.target.closest('details').open;
    }
  },

  enfocarNuevoItemNota() {
    document.getElementById('nota-item-nuevo')?.focus();
  },

  // ---------------- Cambios ----------------
  setNotaTitulo(id, texto) {
    const nota = this.buscarNota(id);
    if (!nota) return;
    nota.title = String(texto || '').slice(0, 300);
    this.notaCambiada(nota, { meta: true, alEscribir: true });
  },

  setNotaTexto(id, texto) {
    const nota = this.buscarNota(id);
    if (!nota) return;
    nota.text = String(texto || '').slice(0, 20000);
    this.notaCambiada(nota, { meta: true, alEscribir: true });
  },

  setNotaColor(id, color) {
    const nota = this.buscarNota(id);
    if (!nota || !NotasCore.COLORES[color]) return;
    nota.color = color;
    this.notaCambiada(nota, { meta: true });
    this.refrescarNotas();
  },

  fijarNota(id, ev) {
    this.detenerClic(ev);
    const nota = this.buscarNota(id);
    if (!nota) return;
    nota.pinned = !nota.pinned;
    this.notaCambiada(nota, { meta: true });
    this.refrescarNotas();
  },

  archivarNota(id, ev) {
    this.detenerClic(ev);
    const nota = this.buscarNota(id);
    if (!nota) return;
    nota.archived = !nota.archived;
    if (nota.archived) nota.pinned = false;
    this.notaCambiada(nota, { meta: true });
    if (this.notaAbiertaId === id) this.cerrarNota();
    this.refrescarNotas();
    this.showToast(nota.archived ? '📦 Archivada.' : '📤 De vuelta en tus listas.', () => this.archivarNota(id), 'Deshacer');
  },

  borrarNota(id, ev) {
    this.detenerClic(ev);
    const nota = this.buscarNota(id);
    if (!nota) return;
    const copia = JSON.parse(JSON.stringify(nota));
    if (this.notaAbiertaId === id) {
      this._notaRecienCreada = null;
      this.cerrarNota();
    }
    Object.assign(nota, { deleted: true, title: '', text: '', items: [] });
    this.notaCambiada(nota, { meta: true });
    this.refrescarNotas();
    this.showToast('🗑️ Borrada.', () => this.restaurarNota(copia), 'Deshacer');
  },

  restaurarNota(copia) {
    const notas = this.listaNotas();
    const i = notas.findIndex(n => n.id === copia.id);
    copia.deleted = false;
    if (i >= 0) notas[i] = copia;
    else notas.push(copia);
    this.notaCambiada(copia, { meta: true });
    this.refrescarNotas();
  },

  alternarTipoNota(id) {
    const nota = this.buscarNota(id);
    if (!nota) return;
    if (nota.kind === 'lista') NotasCore.aTexto(nota);
    else NotasCore.aLista(nota);
    this.notaCambiada(nota, { meta: true });
    this.refrescarNotas();
  },

  agregarItemNota(id) {
    const nota = this.buscarNota(id);
    const campo = /** @type {HTMLInputElement|null} */ (document.getElementById('nota-item-nuevo'));
    if (!nota || !campo) return;
    // Pegar varias líneas crea un pendiente por línea
    const textos = campo.value.split(/\r?\n/).map(t => t.trim()).filter(Boolean);
    if (!textos.length) return;
    nota.items = [...(nota.items || []), ...textos.map(t => NotasCore.crearItem(t.slice(0, 2000)))];
    this.notaCambiada(nota);
    this.refrescarNotas();
    this.enfocarNuevoItemNota();
  },

  itemDeNota(id, itemId) {
    const nota = this.buscarNota(id);
    const item = nota ? (nota.items || []).find(i => i.id === itemId && !i.deleted) : null;
    return item ? { nota, item } : null;
  },

  marcarItemNota(id, itemId, hecho) {
    const par = this.itemDeNota(id, itemId);
    if (!par) return;
    par.item.done = hecho === true;
    par.item.updatedAt = new Date().toISOString();
    this.notaCambiada(par.nota);
    if (par.item.done && 'vibrate' in navigator && this.state?.settings?.vibration) {
      try { navigator.vibrate(15); } catch (e) {}
    }
    this.refrescarNotas();
  },

  setItemNotaTexto(id, itemId, texto) {
    const par = this.itemDeNota(id, itemId);
    if (!par) return;
    const limpio = String(texto || '').trim().slice(0, 2000);
    if (!limpio) return this.borrarItemNota(id, itemId);
    if (limpio === par.item.text) return;
    par.item.text = limpio;
    par.item.updatedAt = new Date().toISOString();
    this.notaCambiada(par.nota);
    if (this.currentView === 'notas') this.renderNotasGrid();
  },

  // Quita (con marca de borrado) y ofrece deshacer
  quitarItemsNota(nota, items, mensaje) {
    const now = new Date().toISOString();
    items.forEach(item => {
      item.deleted = true;
      item.updatedAt = now;
    });
    this.notaCambiada(nota);
    this.refrescarNotas();
    this.showToast(mensaje, () => {
      const cuando = new Date().toISOString();
      items.forEach(item => {
        delete item.deleted;
        item.updatedAt = cuando;
      });
      const actual = this.buscarNota(nota.id);
      if (!actual) return;
      // Tras un sincronizado la nota es otro objeto: devolver los elementos a la versión actual
      const porId = new Map(items.map(item => [item.id, item]));
      actual.items = (actual.items || []).map(i => porId.get(i.id) || i);
      this.notaCambiada(actual);
      this.refrescarNotas();
    }, 'Deshacer');
  },

  borrarItemNota(id, itemId) {
    const par = this.itemDeNota(id, itemId);
    if (par) this.quitarItemsNota(par.nota, [par.item], 'Pendiente quitado.');
  },

  borrarHechosNota(id) {
    const nota = this.buscarNota(id);
    const hechos = nota ? NotasCore.hechos(nota) : [];
    if (hechos.length) this.quitarItemsNota(nota, hechos, `${hechos.length} completados quitados.`);
  },

  // ---------------- Widgets de Android (puente NexusNative; en el navegador no hace nada) ----------------
  // La app nativa guarda una copia de las listas para pintarlas con la app cerrada.
  publicarNotasEnWidget() {
    const nativo = window.NexusNative;
    if (!nativo || typeof nativo.publishNotas !== 'function') return;
    try {
      const notas = NotasCore.visibles(this.listaNotas()).map(n => ({
        id: n.id, kind: n.kind, title: n.title, text: n.text, color: n.color, pinned: n.pinned === true,
        createdAt: n.createdAt, updatedAt: n.updatedAt,
        items: NotasCore.itemsVivos(n).map(i => ({ id: i.id, text: i.text, done: i.done === true, updatedAt: i.updatedAt }))
      }));
      nativo.publishNotas(JSON.stringify(notas));
    } catch (e) {
      console.warn('No se pudo actualizar el widget:', e);
    }
  },

  // Con sesión, el widget también habla con el servidor por su cuenta (marcar y añadir sin abrir la app)
  enlazarWidgetNativo() {
    const nativo = window.NexusNative;
    if (!nativo || typeof nativo.setSession !== 'function') return;
    try {
      const token = localStorage.getItem('nexus_session_token') || '';
      nativo.setSession(new URL(this.API_BASE, window.location.href).href, token);
    } catch (e) {}
  },

  // Lo marcado o añadido en el widget sin red: se aplica aquí y sale con el siguiente sincronizado
  recogerCambiosDelWidget() {
    const nativo = window.NexusNative;
    if (!nativo || typeof nativo.getWidgetOps !== 'function') return;
    let ops = [];
    try { ops = JSON.parse(nativo.getWidgetOps() || '[]'); } catch (e) {}
    if (Array.isArray(ops) && ops.length) {
      let cambios = false;
      for (const op of ops) {
        if (op && op.type === 'pensamiento') {
          // Widget «Soltar»: entra por el mismo embudo que cualquier captura (clasificación, repetidos)
          if (String(op.text || '').trim()) this.captureThought(String(op.text), { source: 'widget', silent: true });
          continue;
        }
        cambios = NotasCore.aplicarOperacion(this.listaNotas(), op) || cambios;
      }
      this.saveState();
      try { nativo.ackWidgetOps(JSON.stringify(ops.map(op => op.opId))); } catch (e) {}
      if (cambios) {
        this.guardarNotas();
        this.refrescarNotas();
        return;
      }
    }
    this.publicarNotasEnWidget();
  },
});
