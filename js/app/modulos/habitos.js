/* exported HabitosCore */
// Módulo Hábitos (Fase 22). Arriba la lógica sin DOM (HabitosCore); abajo la ficha de Repasar.
// Principios: la racha es flexible (un día sin hacerlo no la rompe; dos seguidos sí), se cuenta
// lo hecho y nunca lo que falta, y un hábito pendiente es como mucho una sugerencia en «Ahora».
// Documento (colección «habits»): { id, name, emoji, days: [0-6] (vacío = todos los días),
//   marks: { 'AAAA-MM-DD': { done, at } }, createdAt, updatedAt, deleted? }
const HabitosCore = (() => {
  const DIA = 24 * 60 * 60000;
  const MAX_NOMBRE = 80;
  const DIAS_GUARDADOS = 400;
  const LETRAS = ['D', 'L', 'M', 'X', 'J', 'V', 'S']; // getDay(): 0 = domingo

  function claveDia(ms) {
    const d = new Date(ms);
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  // Mediodía del día `n` días antes de `ms`: evita saltos por cambios de hora
  function diaAtras(ms, n) {
    const d = new Date(ms);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - n);
    return d.getTime();
  }

  const nuevoId = () => 'h' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function limpiarDias(days) {
    const set = new Set((Array.isArray(days) ? days : []).map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6));
    return set.size === 7 ? [] : [...set].sort((a, b) => a - b);
  }

  function crear(datos = {}, ahoraIso = new Date().toISOString()) {
    const name = String(datos.name || '').trim().slice(0, MAX_NOMBRE);
    if (!name) return null;
    return { id: datos.id || nuevoId(), name, emoji: String(datos.emoji || '🌱').trim().slice(0, 8) || '🌱', days: limpiarDias(datos.days), marks: {}, createdAt: ahoraIso, updatedAt: ahoraIso };
  }

  const toca = (habito, ms) => !habito.days || !habito.days.length || habito.days.includes(new Date(ms).getDay());
  const hecho = (habito, clave) => !!(habito.marks && habito.marks[clave] && habito.marks[clave].done);

  // Devuelve una copia con el día marcado (o desmarcado). Las marcas muy viejas se sueltan.
  function marcar(habito, clave, done = true, ahoraIso = new Date().toISOString()) {
    const limite = claveDia(new Date(ahoraIso).getTime() - DIAS_GUARDADOS * DIA);
    const marks = {};
    for (const [k, v] of Object.entries(habito.marks || {})) if (k >= limite) marks[k] = v;
    marks[clave] = { done: !!done, at: ahoraIso };
    return { ...habito, marks, updatedAt: ahoraIso };
  }

  // Días seguidos (de los que tocan) hechos hasta hoy. Hoy sin hacer todavía no cuenta en contra.
  function racha(habito, ahoraMs) {
    let n = 0;
    let fallos = 0;
    for (let i = 0; i < DIAS_GUARDADOS; i++) {
      const ms = diaAtras(ahoraMs, i);
      if (!toca(habito, ms)) continue;
      if (hecho(habito, claveDia(ms))) { n++; fallos = 0; continue; }
      if (i === 0) continue;
      if (++fallos >= 2) break;
    }
    return n;
  }

  // Veces hecho en los últimos `dias` días (hoy incluido)
  function hechosEn(habito, ahoraMs, dias = 7) {
    let n = 0;
    for (let i = 0; i < dias; i++) if (hecho(habito, claveDia(diaAtras(ahoraMs, i)))) n++;
    return n;
  }

  // Últimos `dias` días, del más antiguo al de hoy
  function mapa(habito, ahoraMs, dias = 28) {
    const out = [];
    for (let i = dias - 1; i >= 0; i--) {
      const ms = diaAtras(ahoraMs, i);
      const clave = claveDia(ms);
      out.push({ clave, done: hecho(habito, clave), toca: toca(habito, ms) });
    }
    return out;
  }

  const pendientesHoy = (habitos, ahoraMs) => (habitos || []).filter(h => h && !h.deleted && toca(h, ahoraMs) && !hecho(h, claveDia(ahoraMs)));

  function textoDias(habito) {
    if (!habito.days || !habito.days.length) return 'Todos los días';
    return [1, 2, 3, 4, 5, 6, 0].filter(d => habito.days.includes(d)).map(d => LETRAS[d]).join(' · ');
  }

  // Por nombre: exacto primero, luego por coincidencia parcial (lo usa Jarvis)
  function buscar(habitos, nombre) {
    const n = String(nombre || '').trim().toLowerCase();
    if (!n) return null;
    const vivos = (habitos || []).filter(h => h && !h.deleted);
    return vivos.find(h => h.name.toLowerCase() === n) || vivos.find(h => h.name.toLowerCase().includes(n) || n.includes(h.name.toLowerCase())) || null;
  }

  return { LETRAS, claveDia, crear, limpiarDias, toca, hecho, marcar, racha, hechosEn, mapa, pendientesHoy, textoDias, buscar };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = HabitosCore;
}

if (typeof ModulosCore !== 'undefined' && typeof defineAppMethods === 'function') ModulosCore.registrar({
  id: 'habitos', nombre: 'Hábitos', icono: '🌱', coleccion: 'habits', render: 'renderViewHabitos',
  descripcion: 'Rutinas con racha flexible: un día sin hacerlo no la rompe.',
  candidatosAhora: (docs, ahoraMs) => HabitosCore.pendientesHoy(docs, ahoraMs).slice(0, 1).map(h => ({
    texto: `${h.emoji} ${h.name}`, boton: 'Hecho', accion: ['marcarHabito', h.id, true]
  })),
  resumen: (docs, ahoraMs) => {
    const p = HabitosCore.pendientesHoy(docs, ahoraMs);
    return p.length ? `Hábitos de hoy: ${p.slice(0, 3).map(h => h.name).join(' · ')}${p.length > 3 ? '…' : ''}` : '';
  }
});

// En los tests (sin app) no se define nada
(typeof defineAppMethods === 'function' ? defineAppMethods : () => {})({

  renderViewHabitos(container) {
    const ahora = Date.now();
    const hoy = HabitosCore.claveDia(ahora);
    const habitos = this.modVivos('habits');
    const dia = (d, letra) => html`<label class="inline-flex items-center justify-center w-9 h-9 rounded-full border theme-border text-xs font-semibold cursor-pointer has-[:checked]:bg-emerald-500/20 has-[:checked]:border-emerald-500/60">
      <input type="checkbox" name="habito-dia" value="${d}" class="sr-only" />${letra}</label>`;
    const tarjeta = h => {
      const done = HabitosCore.hecho(h, hoy);
      const tocaHoy = HabitosCore.toca(h, ahora);
      const racha = HabitosCore.racha(h, ahora);
      const semana = HabitosCore.hechosEn(h, ahora, 7);
      return html`
        <article class="p-3.5 rounded-2xl theme-card border theme-border space-y-2.5">
          <div class="flex items-center gap-3">
            <button type="button" data-on-click="${accion('marcarHabito', h.id, !done)}" aria-pressed="${String(done)}"
              aria-label="${done ? 'Desmarcar' : 'Marcar hecho hoy'}: ${h.name}"
              class="w-11 h-11 shrink-0 rounded-full border-2 flex items-center justify-center text-lg font-bold transition active:scale-90 ${done ? 'bg-emerald-500 border-emerald-500 text-slate-950' : 'border-emerald-500/50 text-emerald-400'}">✓</button>
            <div class="min-w-0 flex-1">
              <p class="font-semibold text-sm truncate">${h.emoji} ${h.name}</p>
              <p class="text-[11px] theme-text-muted">${HabitosCore.textoDias(h)}${tocaHoy ? '' : ' · hoy no toca'}</p>
            </div>
            <button type="button" data-on-click="${accion('borrarHabito', h.id)}" class="w-9 h-9 shrink-0 rounded-xl theme-text-muted hover:text-rose-400 text-xs" aria-label="Quitar ${h.name}" title="Quitar">✕</button>
          </div>
          <div class="flex items-center gap-1" aria-hidden="true">
            ${HabitosCore.mapa(h, ahora, 28).map(c => html`<span class="h-2.5 flex-1 rounded-sm ${c.done ? 'bg-emerald-500' : 'bg-slate-500/15'}" title="${c.clave}"></span>`)}
          </div>
          <p class="text-[11px] theme-text-muted">${racha > 0 ? html`🔥 Racha de ${racha} · ` : ''}Esta semana: ${semana} ${semana === 1 ? 'vez' : 'veces'}</p>
        </article>`;
    };
    container.innerHTML = html`
      <div class="max-w-2xl mx-auto space-y-4 py-2">
        <div>
          <h1 class="text-2xl font-display font-extrabold">🌱 Hábitos</h1>
          <p class="text-xs theme-text-muted mt-1">Un día sin hacerlo no rompe la racha. Aquí se cuenta lo hecho.</p>
        </div>
        ${habitos.length ? html`<div class="space-y-2.5">${habitos.map(tarjeta)}</div>`
          : html`<p class="p-4 rounded-2xl theme-card-subtle border theme-border text-sm theme-text-muted">Aún no hay hábitos. Empieza por uno pequeño: «vaso de agua al levantarme».</p>`}
        <form id="habito-form" data-on-submit="${accion('crearHabito', '$event')}" class="p-3.5 rounded-2xl theme-card-subtle border theme-border space-y-3">
          <div class="flex gap-2">
            <input id="habito-emoji" type="text" maxlength="4" value="🌱" aria-label="Emoji" class="w-14 px-2 py-2 rounded-xl bg-transparent border theme-border text-center text-sm outline-none focus:border-emerald-500" />
            <input id="habito-nombre" type="text" maxlength="80" required placeholder="Nuevo hábito" aria-label="Nombre del hábito" class="flex-1 min-w-0 px-3 py-2 rounded-xl bg-transparent border theme-border text-sm outline-none focus:border-emerald-500" />
          </div>
          <div class="flex items-center gap-1.5 flex-wrap" role="group" aria-label="Días (sin marcar ninguno: todos)">
            ${[1, 2, 3, 4, 5, 6, 0].map(d => dia(d, HabitosCore.LETRAS[d]))}
            <span class="text-[11px] theme-text-muted ml-1">Sin marcar: todos los días</span>
          </div>
          <button type="submit" class="min-h-[44px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold">Añadir hábito</button>
        </form>
      </div>`;
  },

  crearHabito(ev) {
    if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
    const valor = id => String(/** @type {HTMLInputElement|null} */ (document.getElementById(id))?.value || '');
    const days = [...document.querySelectorAll('#habito-form input[name="habito-dia"]:checked')].map(el => Number(/** @type {HTMLInputElement} */ (el).value));
    const habito = HabitosCore.crear({ name: valor('habito-nombre'), emoji: valor('habito-emoji'), days });
    if (!habito) return;
    this.modGuardar('habits', habito);
    this.render();
    this.showToast(`🌱 Hábito añadido: ${habito.name}`);
  },

  marcarHabito(id, done = true) {
    const habito = this.modVivos('habits').find(h => h.id === id);
    if (!habito) return;
    const ahora = Date.now();
    const nuevo = HabitosCore.marcar(habito, HabitosCore.claveDia(ahora), done);
    this.modGuardar('habits', nuevo);
    this.render();
    if (!done) return;
    if (this.state.settings?.vibration && 'vibrate' in navigator) { try { navigator.vibrate(18); } catch (e) {} }
    const racha = HabitosCore.racha(nuevo, ahora);
    this.showToast(`✓ ${nuevo.name}${racha > 1 ? ` · racha de ${racha}` : ''}`, () => this.marcarHabito(id, false), 'Deshacer');
  },

  borrarHabito(id) {
    const habito = this.modVivos('habits').find(h => h.id === id);
    if (!habito) return;
    this.modBorrar('habits', id);
    this.render();
    this.showToast(`Hábito quitado: ${habito.name}`, () => { this.modGuardar('habits', { ...habito, deleted: false }); this.render(); }, 'Deshacer');
  },
});
