/* exported NexusErrores */
'use strict';
// Registro de errores del navegador (Fase 9). Se carga el primero para ver también los fallos de arranque.
// Envía al servidor (POST /api/client-errors) el mensaje del error y dónde ocurrió: archivo, línea y vista.
// Nunca el contenido de pensamientos, tareas o listas. Sin sesión o sin red no envía nada.
// Como mucho 10 por visita y nunca dos veces el mismo, para que un error en bucle no inunde el servidor.
const NexusErrores = (() => {
  const MAX_POR_VISITA = 10;
  const vistos = new Set();
  let enviados = 0;

  // Rutas en vez de direcciones completas: el dominio propio no aporta nada y alarga el texto
  function sinOrigen(texto, origen) {
    const limpio = String(texto || '');
    return origen ? limpio.split(origen).join('') : limpio;
  }

  // Devuelve lo que se enviaría, o null si se descarta (vacío, repetido, ajeno o por encima del límite)
  function preparar(kind, message, extra = {}, entorno = {}) {
    const mensaje = String(message || '').trim();
    // "Script error." es lo que da el navegador para scripts de otro origen: no dice nada útil
    if (!mensaje || mensaje === 'Script error.' || enviados >= MAX_POR_VISITA) return null;
    const origen = entorno.origen || '';
    const source = sinOrigen(extra.source, origen).slice(0, 300);
    const clave = `${mensaje}|${source}|${extra.line || ''}`;
    if (vistos.has(clave)) return null;
    vistos.add(clave);
    enviados++;
    const payload = { kind, message: sinOrigen(mensaje, origen).slice(0, 500) };
    if (source) payload.source = source;
    if (Number.isInteger(extra.line)) payload.line = extra.line;
    if (Number.isInteger(extra.column)) payload.column = extra.column;
    if (extra.stack) payload.stack = sinOrigen(extra.stack, origen).slice(0, 3000);
    if (entorno.vista) payload.view = String(entorno.vista).slice(0, 40);
    if (entorno.userAgent) payload.userAgent = String(entorno.userAgent).slice(0, 300);
    return payload;
  }

  function reiniciar() {
    vistos.clear();
    enviados = 0;
  }

  // La misma regla que js/app.js: rutas relativas tras el proxy, puerto directo en desarrollo
  function apiBase() {
    const { protocol, port, hostname } = window.location;
    const directo = !protocol.startsWith('http') || port === '3000' || port === '5173';
    return directo ? `http://${hostname || 'localhost'}:8081/api` : '/api';
  }

  function reportar(kind, message, extra) {
    try {
      const payload = preparar(kind, message, extra, {
        origen: window.location.origin,
        vista: window.location.hash.replace('#', ''),
        userAgent: navigator.userAgent
      });
      const token = localStorage.getItem('nexus_session_token');
      if (!payload || !token || navigator.onLine === false) return;
      fetch(`${apiBase()}/client-errors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
        keepalive: true
      }).catch(() => {});
    } catch (e) {
      // El registro de errores nunca debe provocar otro error
    }
  }

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('error', ev => {
      // Sin mensaje: es una imagen o script que no cargó, no un fallo de código
      if (!ev || !ev.message) return;
      reportar('error', ev.message, { source: ev.filename, line: ev.lineno, column: ev.colno, stack: ev.error && ev.error.stack });
    });
    window.addEventListener('unhandledrejection', ev => {
      const motivo = ev && ev.reason;
      reportar('promesa', motivo && motivo.message ? motivo.message : String(motivo), { stack: motivo && motivo.stack });
    });
  }

  return { preparar, reportar, reiniciar, MAX_POR_VISITA };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = NexusErrores;
}
