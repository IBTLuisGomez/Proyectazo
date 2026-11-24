/* exported NotasCore */
// Notas y listas de pendientes (tipo Keep): modelo y mezcla entre dispositivos, sin DOM.
// Lo usan la vista (js/app/views/notas.js) y los tests de Node. La misma regla de mezcla está en
// server/store.py (merge_nota) y en el widget de Android (NotasStore.kt): si cambias una, cambia las tres.
//
// Nota:  { id, kind: 'lista'|'nota', title, text, color, pinned, archived, deleted, items, createdAt, updatedAt, metaAt }
// Item:  { id, text, done, updatedAt, deleted? }
//   updatedAt = último cambio de cualquier tipo (decide qué se envía al sincronizar)
//   metaAt    = último cambio de título, texto, color, fijada, archivada, borrada u orden
// Borrar deja una marca (deleted) en vez de quitar: así otro dispositivo no resucita lo borrado.
const NotasCore = (() => {
  const COLORES = {
    ninguno: { nombre: 'Sin color', rgb: null },
    coral: { nombre: 'Coral', rgb: '244, 63, 94' },
    naranja: { nombre: 'Naranja', rgb: '249, 115, 22' },
    arena: { nombre: 'Arena', rgb: '234, 179, 8' },
    menta: { nombre: 'Menta', rgb: '16, 185, 129' },
    cielo: { nombre: 'Cielo', rgb: '6, 182, 212' },
    azul: { nombre: 'Azul', rgb: '59, 130, 246' },
    lavanda: { nombre: 'Lavanda', rgb: '139, 92, 246' },
    rosa: { nombre: 'Rosa', rgb: '236, 72, 153' }
  };

  function tiempo(value) {
    if (!value) return 0;
    const t = new Date(value).getTime();
    return Number.isFinite(t) ? t : 0;
  }

  function uid(prefix) {
    return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  }

  function ahora() {
    return new Date().toISOString();
  }

  function crearItem(text, now = ahora()) {
    return { id: uid('i'), text: String(text || '').trim(), done: false, updatedAt: now };
  }

  function crear({ kind = 'lista', title = '', text = '', items = [] } = {}, now = ahora()) {
    return {
      id: uid('n'), kind: kind === 'nota' ? 'nota' : 'lista', title, text, color: 'ninguno',
      pinned: false, archived: false, deleted: false,
      items: items.map(t => crearItem(t, now)).filter(i => i.text),
      createdAt: now, updatedAt: now, metaAt: now
    };
  }

  const tiempoMeta = n => tiempo(n.metaAt || n.updatedAt);

  // Mezcla dos versiones de la misma nota. Con fechas iguales gana `local`.
  function mezclar(local, remota) {
    const [gana, pierde] = tiempoMeta(remota) > tiempoMeta(local) ? [remota, local] : [local, remota];
    const out = { ...pierde, ...gana };
    for (const flag of ['pinned', 'archived', 'deleted']) out[flag] = gana[flag] === true;
    const porId = new Map();
    for (const item of [...(gana.items || []), ...(pierde.items || [])]) {
      if (!item || !item.id) continue;
      const actual = porId.get(item.id);
      // Map conserva la posición de la primera vez: el orden lo pone la versión que gana
      if (!actual || tiempo(item.updatedAt) > tiempo(actual.updatedAt)) porId.set(item.id, item);
    }
    out.items = out.deleted ? [] : [...porId.values()];
    out.id = local.id;
    const creadas = [local.createdAt, remota.createdAt].filter(Boolean);
    out.createdAt = creadas.sort((a, b) => tiempo(a) - tiempo(b))[0] || null;
    out.updatedAt = tiempo(remota.updatedAt) > tiempo(local.updatedAt) ? remota.updatedAt : local.updatedAt;
    out.metaAt = gana.metaAt || gana.updatedAt;
    return out;
  }

  // Mezcla la lista del servidor en la local (devuelve una lista nueva; las que solo están aquí se conservan)
  function mezclarListas(locales, remotas) {
    const out = (locales || []).filter(n => n && n.id).map(n => n);
    const indice = new Map(out.map((n, i) => [n.id, i]));
    for (const remota of remotas || []) {
      if (!remota || !remota.id) continue;
      if (indice.has(remota.id)) out[indice.get(remota.id)] = mezclar(out[indice.get(remota.id)], remota);
      else {
        indice.set(remota.id, out.length);
        out.push(remota);
      }
    }
    return out;
  }

  const itemsVivos = n => (n.items || []).filter(i => i && !i.deleted);
  const pendientes = n => itemsVivos(n).filter(i => !i.done);
  const hechos = n => itemsVivos(n).filter(i => i.done);

  function estaVacia(n) {
    return !String(n.title || '').trim() && !String(n.text || '').trim() && !itemsVivos(n).some(i => i.text.trim());
  }

  // Fijadas primero; dentro de cada grupo, la más nueva arriba (editar no las cambia de sitio)
  function ordenar(notas) {
    return [...notas].sort((a, b) => (b.pinned === true) - (a.pinned === true) || tiempo(b.createdAt) - tiempo(a.createdAt));
  }

  function visibles(notas, { archivo = false, busqueda = '' } = {}) {
    const q = busqueda.trim().toLowerCase();
    return ordenar((notas || []).filter(n => {
      if (!n || n.deleted || (n.archived === true) !== archivo) return false;
      if (!q) return true;
      return [n.title, n.text, ...itemsVivos(n).map(i => i.text)].some(t => String(t || '').toLowerCase().includes(q));
    }));
  }

  // Lista ↔ nota de texto (el botón "casillas" de Keep): cada línea es un elemento y al revés
  function aLista(n, now = ahora()) {
    const lineas = String(n.text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    n.items = [...(n.items || []), ...lineas.map(l => crearItem(l, now))];
    n.text = '';
    n.kind = 'lista';
  }

  function aTexto(n, now = ahora()) {
    const lineas = itemsVivos(n).map(i => i.text).filter(Boolean);
    n.text = [n.text, ...lineas].filter(Boolean).join('\n');
    (n.items || []).forEach(i => {
      if (!i.deleted) {
        i.deleted = true;
        i.updatedAt = now;
      }
    });
    n.kind = 'nota';
  }

  // Cambios hechos en el widget de Android mientras la app estaba cerrada.
  // Llevan valores explícitos (no "alternar"), así que aplicarlos dos veces no cambia nada.
  function aplicarOperacion(notas, op) {
    if (!op || !op.type) return false;
    const at = op.at || ahora();
    if (op.type === 'nota' && op.nota && op.nota.id) {
      if (notas.some(n => n.id === op.nota.id)) return false;
      notas.push(op.nota);
      return true;
    }
    const nota = notas.find(n => n.id === op.notaId && !n.deleted);
    if (!nota) return false;
    if (op.type === 'add') {
      if (!op.itemId || !String(op.text || '').trim() || (nota.items || []).some(i => i.id === op.itemId)) return false;
      nota.items = [...(nota.items || []), { id: op.itemId, text: String(op.text).trim(), done: false, updatedAt: at }];
      nota.kind = 'lista';
    } else if (op.type === 'done') {
      const item = (nota.items || []).find(i => i.id === op.itemId && !i.deleted);
      if (!item || tiempo(at) < tiempo(item.updatedAt)) return false;
      item.done = op.done === true;
      item.updatedAt = at;
    } else {
      return false;
    }
    nota.updatedAt = ahora(); // con la hora de este equipo: es la que decide qué se envía al sincronizar
    return true;
  }

  return {
    COLORES, tiempo, uid, crear, crearItem, mezclar, mezclarListas, itemsVivos, pendientes, hechos,
    estaVacia, ordenar, visibles, aLista, aTexto, aplicarOperacion
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NotasCore;
}
