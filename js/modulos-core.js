/* exported ModulosCore */
// Registro de módulos opcionales (Hábitos, Personas, Finanzas…) y mezcla de sus datos entre
// dispositivos (Fase 21). Sin DOM. Regla de oro (docs/ECOSISTEMA_HIVEBRAIN.md): un módulo nunca
// añade una pestaña principal; aporta una ficha a Repasar, candidatos a «Ahora» (se ve uno como
// mucho), una línea al resumen de la mañana y herramientas a Jarvis.
//
//   ModulosCore.registrar({
//     id: 'habitos', nombre: 'Hábitos', icono: '🌱', descripcion: '…', activoPorDefecto: false,
//     coleccion: 'habits',                       // dónde guarda sus documentos (state.modulos.habits)
//     render: 'renderViewHabitos',               // método de la app que pinta la ficha de Repasar
//     candidatosAhora: (docs, ahoraMs) => [{ texto, accion: ['metodo', ...args], boton }],
//     resumen: (docs, ahoraMs) => 'línea para el resumen de la mañana, o vacío'
//   });
const ModulosCore = (() => {
  // Colecciones que se sincronizan con el servidor (la misma lista está en server/store.py)
  const COLECCIONES = ['habits', 'people', 'expenses', 'energy'];
  const PREFIJO_VISTA = 'mod-';
  const registro = [];

  function registrar(def) {
    if (!def || !/^[a-z][a-z0-9-]{1,30}$/.test(String(def.id || ''))) throw new Error('Módulo sin id válido');
    if (registro.some(m => m.id === def.id)) throw new Error(`Módulo duplicado: ${def.id}`);
    if (def.coleccion && !COLECCIONES.includes(def.coleccion)) throw new Error(`Colección desconocida: ${def.coleccion}`);
    const modulo = {
      id: def.id,
      nombre: String(def.nombre || def.id),
      icono: String(def.icono || '🧩'),
      descripcion: String(def.descripcion || ''),
      activoPorDefecto: def.activoPorDefecto === true,
      coleccion: def.coleccion || null,
      render: def.render || null,
      candidatosAhora: typeof def.candidatosAhora === 'function' ? def.candidatosAhora : null,
      resumen: typeof def.resumen === 'function' ? def.resumen : null,
      vista: PREFIJO_VISTA + def.id
    };
    registro.push(modulo);
    return modulo;
  }

  const lista = () => registro.slice();
  const porId = id => registro.find(m => m.id === id) || null;
  const porVista = vista => registro.find(m => m.vista === vista) || null;
  const vistas = () => registro.filter(m => m.render).map(m => m.vista);

  function activo(settings, id) {
    const m = porId(id);
    if (!m) return false;
    const elegido = settings && settings.modulos ? settings.modulos[id] : undefined;
    return typeof elegido === 'boolean' ? elegido : m.activoPorDefecto;
  }

  const activos = settings => registro.filter(m => activo(settings, m.id));

  function tiempo(value) {
    if (!value) return 0;
    const t = new Date(value).getTime();
    return Number.isFinite(t) ? t : 0;
  }

  // ---------------- Mezcla entre dispositivos ----------------
  // Marcas por día (hábitos): { '2026-11-27': { done, at } }. Gana, día a día, la más reciente:
  // marcar hoy en el móvil no pisa lo marcado ayer en el ordenador.
  function mezclarMarcas(a, b) {
    const out = { ...(a || {}) };
    for (const [clave, marca] of Object.entries(b || {})) {
      if (!marca || typeof marca !== 'object') continue;
      const actual = out[clave];
      if (!actual || tiempo(marca.at) > tiempo(actual.at)) out[clave] = marca;
    }
    return out;
  }

  // Un documento: gana el de updatedAt más reciente (con fechas iguales, el local). Las marcas se mezclan aparte.
  function mezclarDoc(local, remoto) {
    if (!local) return remoto;
    if (!remoto) return local;
    const gana = tiempo(remoto.updatedAt) > tiempo(local.updatedAt) ? remoto : local;
    const out = { ...gana };
    if (local.marks || remoto.marks) out.marks = gana.deleted ? {} : mezclarMarcas(local.marks, remoto.marks);
    return out;
  }

  // Dos listas de documentos de una colección. Lo borrado viaja como marca (deleted) para que
  // otro dispositivo no lo resucite.
  function mezclar(local, remoto) {
    const porClave = new Map();
    const orden = [];
    for (const doc of [...(local || []), ...(remoto || [])]) {
      if (!doc || !doc.id) continue;
      if (!porClave.has(doc.id)) orden.push(doc.id);
      porClave.set(doc.id, mezclarDoc(porClave.get(doc.id), doc));
    }
    return orden.map(id => porClave.get(id));
  }

  // estado: { habits: [...], … } → lo cambiado desde `desdeMs` (0 = todo), solo de las colecciones conocidas
  function cambiados(estado, desdeMs) {
    const out = {};
    for (const col of COLECCIONES) {
      const docs = ((estado && estado[col]) || []).filter(d => d && d.id && (!desdeMs || tiempo(d.updatedAt) > desdeMs));
      if (docs.length) out[col] = docs;
    }
    return out;
  }

  function mezclarEstado(estado, remoto) {
    const out = { ...(estado || {}) };
    for (const col of COLECCIONES) {
      if (remoto && Array.isArray(remoto[col])) out[col] = mezclar(out[col], remoto[col]);
      else if (!Array.isArray(out[col])) out[col] = [];
    }
    return out;
  }

  const vivos = docs => (docs || []).filter(d => d && !d.deleted);

  // ---------------- Lo que los módulos activos aportan a «Ahora» y al resumen ----------------
  function candidatos(settings, estado, ahoraMs) {
    const out = [];
    for (const m of activos(settings)) {
      if (!m.candidatosAhora) continue;
      try {
        for (const c of m.candidatosAhora(vivos(estado && estado[m.coleccion]), ahoraMs) || []) {
          if (c && c.texto) out.push({ ...c, modulo: m.id, icono: m.icono });
        }
      } catch (e) { /* un módulo roto no rompe «Ahora» */ }
    }
    return out;
  }

  function resumenes(settings, estado, ahoraMs) {
    const out = [];
    for (const m of activos(settings)) {
      if (!m.resumen) continue;
      try {
        const linea = m.resumen(vivos(estado && estado[m.coleccion]), ahoraMs);
        if (linea) out.push(`${m.icono} ${linea}`);
      } catch (e) { /* igual */ }
    }
    return out;
  }

  function reiniciar() { registro.length = 0; } // solo para tests

  return {
    COLECCIONES, PREFIJO_VISTA, registrar, lista, porId, porVista, vistas, activo, activos,
    mezclarMarcas, mezclarDoc, mezclar, mezclarEstado, cambiados, vivos, candidatos, resumenes, reiniciar
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ModulosCore;
}
