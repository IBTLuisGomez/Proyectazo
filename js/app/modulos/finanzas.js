/* exported FinanzasCore */
// Módulo Finanzas rápidas (Fase 24). Arriba la lógica sin DOM (FinanzasCore); abajo la ficha de Repasar.
// Apuntar un gasto en dos toques («café 65») desde la ficha o desde Soltar. Sin presupuestos ni
// números rojos: solo ver por dónde se va el dinero. En gastos altos, una pregunta suave.
// Documento (colección «expenses»): { id, amount, note, category, impulse, createdAt, updatedAt, deleted? }
const FinanzasCore = (() => {
  const UMBRAL_ALTO = 500;
  const MAX_IMPORTE = 10000000;
  const NUMERO = '(\\d{1,8}(?:[.,]\\d{1,2})?)';
  const MONEDA = '(?:\\s*(?:pesos|euros?|eur|mxn|usd|d[oó]lares|€|\\$))?';
  // «gasté 200 en café», «pagué $1,200.50 de luz», «compré 80 pan»
  const CON_VERBO = new RegExp(`^(?:gast[eé]|pagu[eé]|compr[eé])\\s+\\$?\\s*${NUMERO}${MONEDA}\\s*(?:en|de|por|para)?\\s*(.*)$`, 'i');
  // «café 65», «uber $120»: de una a tres palabras y, al final, el importe
  const CORTO = new RegExp(`^([^\\d$€]{2,40}?)\\s+\\$?\\s*${NUMERO}${MONEDA}$`, 'i');
  // Palabras que, delante de un número, casi nunca son un gasto («llamar 5», «reunión 10»)
  const NO_GASTO = /\b(llamar|llamada|reuni[oó]n|cita|a las|minutos?|min|horas?|d[ií]as?|p[aá]gina|cap[ií]tulo|versi[oó]n|tel[eé]fono|n[uú]mero|piso|sala|talla)\b/i;

  const CATEGORIAS = [
    ['comida', /caf[eé]|comida|cena|desayuno|almuerzo|super|mercado|pan|restaurante|taco|pizza|bebida|cerveza|snack/i],
    ['transporte', /uber|taxi|gasolina|metro|bus|cami[oó]n|peaje|estacionamiento|parking|tren|vuelo/i],
    ['casa', /renta|alquiler|luz|agua|gas|internet|tel[eé]fono|limpieza|mueble|hipoteca/i],
    ['salud', /farmacia|medicina|m[eé]dico|doctor|dentista|terapia|gimnasio|gym/i],
    ['ocio', /cine|juego|netflix|spotify|libro|concierto|bar|fiesta|regalo|ropa|amazon/i]
  ];
  const ICONOS = { comida: '🍽️', transporte: '🚌', casa: '🏠', salud: '💊', ocio: '🎉', otros: '🧾' };

  const nuevoId = () => 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function tiempo(value) {
    if (!value) return 0;
    const t = new Date(value).getTime();
    return Number.isFinite(t) ? t : 0;
  }

  function numero(texto) {
    const n = Number(String(texto).replace(',', '.'));
    return Number.isFinite(n) && n > 0 && n < MAX_IMPORTE ? Math.round(n * 100) / 100 : null;
  }

  function categoria(nota) {
    const hit = CATEGORIAS.find(([, re]) => re.test(String(nota || '')));
    return hit ? hit[0] : 'otros';
  }

  // Texto libre → { amount, note } o null si no parece un gasto.
  // estricto: solo la forma con verbo («gasté…»); es lo que se usa al capturar en Soltar por voz.
  function interpretar(texto, { estricto = false } = {}) {
    // «1,200.50» → «1200.50»: la coma de millares se quita antes de buscar el importe
    const t = String(texto || '').trim().replace(/\s+/g, ' ').replace(/(\d),(?=\d{3}(?:\D|$))/g, '$1');
    if (!t || t.length > 120) return null;
    let m = CON_VERBO.exec(t);
    if (m) {
      const amount = numero(m[1]);
      return amount ? { amount, note: (m[2] || '').trim().slice(0, 80) || 'Gasto' } : null;
    }
    if (estricto) return null;
    m = CORTO.exec(t);
    if (!m) return null;
    const note = m[1].trim();
    if (note.split(' ').length > 3 || NO_GASTO.test(t)) return null;
    const amount = numero(m[2]);
    return amount ? { amount, note: note.slice(0, 80) } : null;
  }

  function crear(datos = {}, ahoraIso = new Date().toISOString()) {
    const amount = numero(datos.amount);
    if (!amount) return null;
    const note = String(datos.note || '').trim().slice(0, 80) || 'Gasto';
    return { id: datos.id || nuevoId(), amount, note, category: datos.category || categoria(note), impulse: datos.impulse === true, createdAt: ahoraIso, updatedAt: ahoraIso };
  }

  const esAlto = (amount, umbral = UMBRAL_ALTO) => amount >= (Number(umbral) > 0 ? Number(umbral) : UMBRAL_ALTO);

  function inicioSemana(ms) {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.getTime();
  }

  function inicioMes(ms) {
    const d = new Date(ms);
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  }

  const redondear = n => Math.round(n * 100) / 100;

  // Totales de la semana y del mes en curso, y el mes repartido por categoría (de mayor a menor)
  function totales(gastos, ahoraMs) {
    const semanaDesde = inicioSemana(ahoraMs);
    const mesDesde = inicioMes(ahoraMs);
    let semana = 0;
    let mes = 0;
    let impulsos = 0;
    const cats = {};
    for (const g of gastos || []) {
      if (!g || g.deleted || !(g.amount > 0)) continue;
      const at = tiempo(g.createdAt);
      if (at >= semanaDesde) semana += g.amount;
      if (at >= mesDesde) {
        mes += g.amount;
        cats[g.category || 'otros'] = (cats[g.category || 'otros'] || 0) + g.amount;
        if (g.impulse) impulsos += g.amount;
      }
    }
    const porCategoria = Object.entries(cats).map(([categoriaId, total]) => ({ categoria: categoriaId, total: redondear(total), pct: mes ? Math.round((total / mes) * 100) : 0 })).sort((a, b) => b.total - a.total);
    return { semana: redondear(semana), mes: redondear(mes), impulsos: redondear(impulsos), porCategoria };
  }

  const recientes = (gastos, n = 15) => (gastos || []).filter(g => g && !g.deleted).sort((a, b) => tiempo(b.createdAt) - tiempo(a.createdAt)).slice(0, n);

  const dinero = n => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  return { UMBRAL_ALTO, ICONOS, interpretar, categoria, crear, esAlto, totales, recientes, dinero, inicioSemana, inicioMes };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = FinanzasCore;
}

if (typeof ModulosCore !== 'undefined' && typeof defineAppMethods === 'function') ModulosCore.registrar({
  id: 'finanzas', nombre: 'Finanzas rápidas', icono: '💸', coleccion: 'expenses', render: 'renderViewFinanzas',
  descripcion: 'Apunta un gasto en dos toques («café 65») y mira por dónde se va el dinero.'
});

// En los tests (sin app) no se define nada
(typeof defineAppMethods === 'function' ? defineAppMethods : () => {})({

  renderViewFinanzas(container) {
    const ahora = Date.now();
    const gastos = this.modVivos('expenses');
    const t = FinanzasCore.totales(gastos, ahora);
    const fila = g => html`
      <div class="flex items-center gap-2.5 p-2.5 rounded-xl theme-card-subtle border theme-border">
        <span class="text-base" aria-hidden="true">${FinanzasCore.ICONOS[g.category] || FinanzasCore.ICONOS.otros}</span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold truncate">${g.note}</p>
          <p class="text-[11px] theme-text-muted">${new Date(g.createdAt).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}${g.impulse ? ' · ⚡ impulso' : ''}</p>
        </div>
        <span class="font-mono text-sm shrink-0">${FinanzasCore.dinero(g.amount)}</span>
        <button type="button" data-on-click="${accion('marcarImpulso', g.id, !g.impulse)}" aria-pressed="${String(!!g.impulse)}" class="w-9 h-9 shrink-0 rounded-xl text-xs ${g.impulse ? 'text-amber-300' : 'theme-text-muted'}" title="${g.impulse ? 'Fue necesidad' : 'Fue un impulso'}" aria-label="Marcar como impulso: ${g.note}">⚡</button>
        <button type="button" data-on-click="${accion('borrarGasto', g.id)}" class="w-9 h-9 shrink-0 rounded-xl theme-text-muted hover:text-rose-400 text-xs" aria-label="Quitar ${g.note}" title="Quitar">✕</button>
      </div>`;
    container.innerHTML = html`
      <div class="max-w-2xl mx-auto space-y-4 py-2">
        <div>
          <h1 class="text-2xl font-display font-extrabold">💸 Finanzas rápidas</h1>
          <p class="text-xs theme-text-muted mt-1">Sin presupuestos ni culpa: solo ver por dónde se va.</p>
        </div>
        <form data-on-submit="${accion('apuntarGastoRapido', '$event')}" class="flex gap-2">
          <input id="gasto-texto" type="text" maxlength="120" required placeholder="café 65" aria-label="Gasto: concepto e importe" class="flex-1 min-w-0 px-3 py-2.5 rounded-xl bg-transparent border theme-border text-sm outline-none focus:border-emerald-500" />
          <button type="submit" class="min-h-[44px] px-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold">Apuntar</button>
        </form>
        <div class="grid grid-cols-2 gap-2.5">
          <div class="p-3.5 rounded-2xl theme-card border theme-border"><p class="text-[11px] font-mono uppercase tracking-wider theme-text-muted">Esta semana</p><p class="text-xl font-display font-bold mt-0.5">${FinanzasCore.dinero(t.semana)}</p></div>
          <div class="p-3.5 rounded-2xl theme-card border theme-border"><p class="text-[11px] font-mono uppercase tracking-wider theme-text-muted">Este mes</p><p class="text-xl font-display font-bold mt-0.5">${FinanzasCore.dinero(t.mes)}</p>${t.impulsos ? html`<p class="text-[11px] theme-text-muted">⚡ ${FinanzasCore.dinero(t.impulsos)} en impulsos</p>` : ''}</div>
        </div>
        ${t.porCategoria.length ? html`
          <div class="p-3.5 rounded-2xl theme-card border theme-border space-y-2">
            ${t.porCategoria.map(c => html`
              <div>
                <div class="flex justify-between text-xs"><span>${FinanzasCore.ICONOS[c.categoria] || '🧾'} ${c.categoria}</span><span class="font-mono theme-text-muted">${FinanzasCore.dinero(c.total)}</span></div>
                <div class="h-1.5 mt-1 rounded-full bg-slate-500/15 overflow-hidden"><span class="block h-full bg-cyan-500" style="width:${c.pct}%"></span></div>
              </div>`)}
          </div>` : ''}
        ${gastos.length ? html`<div class="space-y-1.5">${FinanzasCore.recientes(gastos).map(fila)}</div>`
          : html`<p class="p-4 rounded-2xl theme-card-subtle border theme-border text-sm theme-text-muted">Escribe el concepto y el importe: «café 65», «gasté 200 en super». También vale desde Soltar con «gasté…».</p>`}
      </div>`;
  },

  // Guarda el gasto y, si es alto, hace la pregunta suave. Devuelve el documento (o null).
  apuntarGasto(datos, opciones = {}) {
    const gasto = FinanzasCore.crear(datos);
    if (!gasto) return null;
    this.modGuardar('expenses', gasto);
    if (String(this.currentView || '').startsWith('mod-')) this.render();
    if (opciones.silent) return gasto;
    const texto = `💸 ${FinanzasCore.dinero(gasto.amount)} · ${gasto.note}`;
    if (FinanzasCore.esAlto(gasto.amount, this.state.settings?.gastoAlto)) {
      this.showToast(`${texto}. ¿Dopamina rápida o necesidad?`, () => this.marcarImpulso(gasto.id, true), 'Fue impulso');
    } else {
      this.showToast(texto, () => this.borrarGasto(gasto.id, true), 'Deshacer');
    }
    return gasto;
  },

  apuntarGastoRapido(ev) {
    if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
    const campo = /** @type {HTMLInputElement|null} */ (document.getElementById('gasto-texto'));
    const datos = FinanzasCore.interpretar(campo?.value || '');
    if (!datos) {
      this.showToast('No veo el importe. Prueba «café 65» o «gasté 200 en super».');
      return;
    }
    this.apuntarGasto(datos);
    document.getElementById('gasto-texto')?.focus();
  },

  // Desde Soltar: «gasté 200 en café» va a Finanzas si el módulo está encendido.
  // Devuelve true si se lo quedó (y entonces no se guarda como pensamiento).
  capturarGasto(texto, opts = {}) {
    if (!this.moduloActivo('finanzas') || opts.category || opts.dueAt) return false;
    const datos = FinanzasCore.interpretar(texto, { estricto: true });
    if (!datos) return false;
    const gasto = this.apuntarGasto(datos, { silent: true });
    if (!gasto) return false;
    if (!opts.silent) {
      this.showToast(`💸 Gasto apuntado: ${FinanzasCore.dinero(gasto.amount)} · ${gasto.note}`, () => {
        this.borrarGasto(gasto.id, true);
        this.captureThought(texto, { ...opts, noModulos: true, skipSplit: true });
      }, 'Era un pensamiento');
    }
    return true;
  },

  marcarImpulso(id, impulso = true) {
    const gasto = this.modVivos('expenses').find(g => g.id === id);
    if (!gasto) return;
    this.modGuardar('expenses', { ...gasto, impulse: !!impulso });
    this.render();
  },

  borrarGasto(id, silencioso = false) {
    const gasto = this.modVivos('expenses').find(g => g.id === id);
    if (!gasto) return;
    this.modBorrar('expenses', id);
    this.render();
    if (silencioso === true) return;
    this.showToast(`Gasto quitado: ${gasto.note}`, () => { this.modGuardar('expenses', { ...gasto, deleted: false }); this.render(); }, 'Deshacer');
  },
});
