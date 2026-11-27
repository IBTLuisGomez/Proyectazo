/* exported PersonasCore */
// Módulo Personas (Fase 23). Arriba la lógica sin DOM (PersonasCore); abajo la ficha de Repasar.
// Para no perder de vista a la gente importante: cada cuánto quieres hablar con alguien y su
// cumpleaños. Nunca una lista de «deudas»: como mucho, una sugerencia en «Ahora».
// Documento (colección «people»): { id, name, birthday: 'MM-DD' | '', everyDays: 0|7|14|30|90,
//   lastContactAt, note, createdAt, updatedAt, deleted? }
const PersonasCore = (() => {
  const DIA = 24 * 60 * 60000;
  const CADA = [0, 7, 14, 30, 90];
  const AVISO_CUMPLE_DIAS = 7;

  const nuevoId = () => 'pe' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function tiempo(value) {
    if (!value) return 0;
    const t = new Date(value).getTime();
    return Number.isFinite(t) ? t : 0;
  }

  // Acepta 'MM-DD' o 'AAAA-MM-DD' (lo que da un <input type="date">) y devuelve 'MM-DD' o ''
  function limpiarCumple(value) {
    const m = /^(?:\d{4}-)?(\d{2})-(\d{2})$/.exec(String(value || '').trim());
    if (!m) return '';
    const mes = Number(m[1]);
    const dia = Number(m[2]);
    return mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31 ? `${m[1]}-${m[2]}` : '';
  }

  function crear(datos = {}, ahoraIso = new Date().toISOString()) {
    const name = String(datos.name || '').trim().slice(0, 80);
    if (!name) return null;
    const cada = Number(datos.everyDays);
    return {
      id: datos.id || nuevoId(), name, birthday: limpiarCumple(datos.birthday), everyDays: CADA.includes(cada) ? cada : 0,
      lastContactAt: datos.lastContactAt || null, note: String(datos.note || '').trim().slice(0, 300), createdAt: ahoraIso, updatedAt: ahoraIso
    };
  }

  // Días desde el último contacto (o desde que se añadió, si aún no hay ninguno)
  function diasSinContacto(persona, ahoraMs) {
    const desde = tiempo(persona.lastContactAt) || tiempo(persona.createdAt);
    return desde ? Math.max(0, Math.floor((ahoraMs - desde) / DIA)) : 0;
  }

  const tocaContactar = (persona, ahoraMs) => persona.everyDays > 0 && diasSinContacto(persona, ahoraMs) >= persona.everyDays;

  // Días que faltan para el próximo cumpleaños (0 = hoy), o null si no se sabe
  function diasParaCumple(persona, ahoraMs) {
    if (!persona.birthday) return null;
    const [mes, dia] = persona.birthday.split('-').map(Number);
    const hoy = new Date(ahoraMs);
    hoy.setHours(0, 0, 0, 0);
    let proximo = new Date(hoy.getFullYear(), mes - 1, dia);
    if (proximo.getTime() < hoy.getTime()) proximo = new Date(hoy.getFullYear() + 1, mes - 1, dia);
    return Math.round((proximo.getTime() - hoy.getTime()) / DIA);
  }

  function registrarContacto(persona, ahoraIso = new Date().toISOString()) {
    return { ...persona, lastContactAt: ahoraIso, updatedAt: ahoraIso };
  }

  // Sugerencias, lo más cercano primero: cumpleaños de esta semana y gente con la que toca hablar
  function sugerencias(personas, ahoraMs) {
    const out = [];
    for (const p of personas || []) {
      if (!p || p.deleted) continue;
      const cumple = diasParaCumple(p, ahoraMs);
      if (cumple !== null && cumple <= AVISO_CUMPLE_DIAS) {
        out.push({ id: p.id, tipo: 'cumple', orden: cumple, texto: cumple === 0 ? `Hoy es el cumpleaños de ${p.name}` : `Cumpleaños de ${p.name} ${cumple === 1 ? 'mañana' : `en ${cumple} días`}` });
      } else if (tocaContactar(p, ahoraMs)) {
        const dias = diasSinContacto(p, ahoraMs);
        out.push({ id: p.id, tipo: 'contacto', orden: 10 + Math.max(0, 1000 - dias), texto: `Hace ${dias} días que no hablas con ${p.name}` });
      }
    }
    return out.sort((a, b) => a.orden - b.orden);
  }

  function buscar(personas, nombre) {
    const n = String(nombre || '').trim().toLowerCase();
    if (!n) return null;
    const vivas = (personas || []).filter(p => p && !p.deleted);
    return vivas.find(p => p.name.toLowerCase() === n) || vivas.find(p => p.name.toLowerCase().includes(n) || n.includes(p.name.toLowerCase())) || null;
  }

  return { CADA, AVISO_CUMPLE_DIAS, crear, limpiarCumple, diasSinContacto, tocaContactar, diasParaCumple, registrarContacto, sugerencias, buscar };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PersonasCore;
}

if (typeof ModulosCore !== 'undefined' && typeof defineAppMethods === 'function') ModulosCore.registrar({
  id: 'personas', nombre: 'Personas', icono: '🫂', coleccion: 'people', render: 'renderViewPersonas',
  descripcion: 'Cumpleaños y cada cuánto quieres hablar con la gente que te importa.',
  candidatosAhora: (docs, ahoraMs) => PersonasCore.sugerencias(docs, ahoraMs).slice(0, 1).map(s => ({
    texto: s.texto, boton: 'Ya hablamos', accion: ['registrarContactoPersona', s.id]
  })),
  resumen: (docs, ahoraMs) => {
    const s = PersonasCore.sugerencias(docs, ahoraMs)[0];
    return s ? `${s.texto}.` : '';
  }
});

// En los tests (sin app) no se define nada
(typeof defineAppMethods === 'function' ? defineAppMethods : () => {})({

  renderViewPersonas(container) {
    const ahora = Date.now();
    const personas = this.modVivos('people').slice().sort((a, b) => a.name.localeCompare(b.name, 'es'));
    const avisos = new Map(PersonasCore.sugerencias(personas, ahora).map(s => [s.id, s]));
    const ordenadas = [...personas.filter(p => avisos.has(p.id)).sort((a, b) => avisos.get(a.id).orden - avisos.get(b.id).orden), ...personas.filter(p => !avisos.has(p.id))];
    const tarjeta = p => {
      const aviso = avisos.get(p.id);
      const dias = PersonasCore.diasSinContacto(p, ahora);
      const cumple = p.birthday ? `🎂 ${p.birthday.slice(3)}/${p.birthday.slice(0, 2)}` : '';
      return html`
        <article class="p-3.5 rounded-2xl theme-card border ${aviso ? 'border-amber-500/40' : 'theme-border'} space-y-1.5">
          <div class="flex items-center gap-3">
            <div class="min-w-0 flex-1">
              <p class="font-semibold text-sm truncate">${p.name}</p>
              <p class="text-[11px] theme-text-muted">${p.lastContactAt ? `Último contacto: hace ${dias} ${dias === 1 ? 'día' : 'días'}` : 'Sin contacto apuntado'}${p.everyDays ? ` · cada ${p.everyDays} días` : ''}${cumple ? ` · ${cumple}` : ''}</p>
            </div>
            <button type="button" data-on-click="${accion('registrarContactoPersona', p.id)}" class="min-h-[40px] px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shrink-0">Hablamos hoy</button>
            <button type="button" data-on-click="${accion('borrarPersona', p.id)}" class="w-9 h-9 shrink-0 rounded-xl theme-text-muted hover:text-rose-400 text-xs" aria-label="Quitar a ${p.name}" title="Quitar">✕</button>
          </div>
          ${aviso ? html`<p class="text-xs text-amber-300">${aviso.tipo === 'cumple' ? '🎂' : '💬'} ${aviso.texto}</p>` : ''}
          ${p.note ? html`<p class="text-xs theme-text-muted">${p.note}</p>` : ''}
        </article>`;
    };
    container.innerHTML = html`
      <div class="max-w-2xl mx-auto space-y-4 py-2">
        <div>
          <h1 class="text-2xl font-display font-extrabold">🫂 Personas</h1>
          <p class="text-xs theme-text-muted mt-1">Para que la gente importante no dependa de tu memoria.</p>
        </div>
        ${ordenadas.length ? html`<div class="space-y-2.5">${ordenadas.map(tarjeta)}</div>`
          : html`<p class="p-4 rounded-2xl theme-card-subtle border theme-border text-sm theme-text-muted">Añade a alguien con quien quieras hablar más a menudo.</p>`}
        <form data-on-submit="${accion('crearPersona', '$event')}" class="p-3.5 rounded-2xl theme-card-subtle border theme-border space-y-3">
          <input id="persona-nombre" type="text" maxlength="80" required placeholder="Nombre" aria-label="Nombre" class="w-full px-3 py-2 rounded-xl bg-transparent border theme-border text-sm outline-none focus:border-emerald-500" />
          <div class="grid grid-cols-2 gap-2">
            <label class="block text-[11px] theme-text-muted">Hablar cada
              <select id="persona-cada" class="mt-1 w-full px-2 py-2 rounded-xl bg-transparent border theme-border text-sm">
                <option value="0">Sin recordatorio</option><option value="7">Semana</option><option value="14">Dos semanas</option><option value="30" selected>Mes</option><option value="90">Tres meses</option>
              </select>
            </label>
            <label class="block text-[11px] theme-text-muted">Cumpleaños (opcional)
              <input id="persona-cumple" type="date" class="mt-1 w-full px-2 py-2 rounded-xl bg-transparent border theme-border text-sm" />
            </label>
          </div>
          <input id="persona-nota" type="text" maxlength="300" placeholder="Nota (opcional): de qué hablasteis, qué le gusta…" aria-label="Nota" class="w-full px-3 py-2 rounded-xl bg-transparent border theme-border text-sm outline-none focus:border-emerald-500" />
          <button type="submit" class="min-h-[44px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold">Añadir persona</button>
        </form>
      </div>`;
  },

  crearPersona(ev) {
    if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
    const valor = id => String(/** @type {HTMLInputElement|null} */ (document.getElementById(id))?.value || '');
    const persona = PersonasCore.crear({ name: valor('persona-nombre'), everyDays: valor('persona-cada'), birthday: valor('persona-cumple'), note: valor('persona-nota') });
    if (!persona) return;
    this.modGuardar('people', persona);
    this.render();
    this.showToast(`🫂 Añadido: ${persona.name}`);
  },

  registrarContactoPersona(id) {
    const persona = this.modVivos('people').find(p => p.id === id);
    if (!persona) return;
    this.modGuardar('people', PersonasCore.registrarContacto(persona));
    this.render();
    this.showToast(`💬 Apuntado: hablaste con ${persona.name}`, () => { this.modGuardar('people', { ...persona }); this.render(); }, 'Deshacer');
  },

  borrarPersona(id) {
    const persona = this.modVivos('people').find(p => p.id === id);
    if (!persona) return;
    this.modBorrar('people', id);
    this.render();
    this.showToast(`Quitado: ${persona.name}`, () => { this.modGuardar('people', { ...persona, deleted: false }); this.render(); }, 'Deshacer');
  },
});
