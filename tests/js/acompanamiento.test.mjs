// Interfaz de foco acompañado y rutinas (Fases 11-14) sobre un DOM mínimo, sin navegador.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { html, raw, accion } = require('../../js/app/ui/html.js');
const FocoCore = require('../../js/foco-core.js');
const src = readFileSync(new URL('../../js/app/features/acompanamiento.js', import.meta.url), 'utf8');

class El {
  constructor() { this.attrs = {}; this.value = ''; this._html = ''; }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = String(v); }
  setAttribute(k, v) { this.attrs[k] = v; }
  addEventListener() {}
  focus() {}
  remove() { for (const k of Object.keys(els)) if (els[k] === this) delete els[k]; }
}
let els = {};
const document = {
  hidden: false,
  getElementById: id => els[id] || null,
  createElement: () => new El(),
  body: { appendChild: el => { els[el.id] = el; } }
};
const store = new Map();
const localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
const NexusAhora = { EFFORT_MINUTES: { XS: 5, S: 15, M: 45, L: 90 } };
const methods = {};
new Function('defineAppMethods', 'html', 'raw', 'accion', 'FocoCore', 'NexusAhora', 'document', 'localStorage', 'navigator', 'setTimeout', src)(
  m => Object.assign(methods, m), html, raw, accion, FocoCore, NexusAhora, document, localStorage, {}, () => 0);

function fakeApp(state = {}) {
  els = {};
  store.clear();
  const app = Object.assign(Object.create(methods), {
    state: { settings: {}, projects: [], ...state },
    currentView: 'otra', toasts: [], saved: 0, notified: [], calls: [],
    saveState() { this.saved++; },
    showToast(m, cb, label) { this.toasts.push({ m, cb, label }); },
    sendSystemNotification(t) { this.notified.push(t); return Promise.resolve(); },
    render() {},
    startQuickReview() { this.calls.push('review'); },
    hibernateProjectWithoutGuilt(id) { this.calls.push(['pausar', id]); this.state.projects.find(p => p.id === id).status = 'hibernado'; },
    dismissStalledProject(id) { this.calls.push(['seguir', id]); }
  });
  return app;
}

// Todas las acciones data-on-* de un HTML apuntan a métodos que existen
function comprobarAcciones(app, htmlText) {
  const unescape = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  let n = 0;
  for (const m of htmlText.matchAll(/data-on-[a-z]+="([^"]*)"/g)) {
    const call = JSON.parse(unescape(m[1]));
    assert.equal(typeof app[call[0]], 'function', `método ${call[0]}`);
    n++;
  }
  return n;
}

test('acompañamiento: se elige el intervalo y el check-in permite anotar la distracción', () => {
  const app = fakeApp();
  assert.equal(app.checkInMinutes(), 0, 'apagado por defecto');
  app.setCheckInMinutes(15);
  assert.equal(app.checkInMinutes(), 15);
  app.setCheckInMinutes(7);
  assert.equal(app.checkInMinutes(), 0, 'solo los intervalos ofrecidos');

  app.setCheckInMinutes(10);
  app.renderEstimacion({ id: 't1', title: 'Escribir <b>intro</b>', effort: 'S' });
  let t = 1e9;
  app.focoTick();
  const realNow = Date.now;
  try {
    for (let i = 0; i < 10 * 60 + 2; i++) { t += 1000; Date.now = () => t; app.focoTick(); }
  } finally { Date.now = realNow; }
  const aviso = app.toasts.find(x => x.label === 'Me distraje');
  assert.ok(aviso, 'pregunta si sigue');
  assert.match(aviso.m, /Escribir <b>intro<\/b>/, 'el toast usa textContent: el título va tal cual');
  aviso.cb();
  assert.equal(app.state.focusDistractions.length, 1);
  assert.equal(app.notified.length, 0, 'con la app a la vista no hace falta notificación del sistema');
});

test('con la app en segundo plano el aviso llega como notificación', () => {
  const app = fakeApp();
  document.hidden = true;
  try { app.mostrarAvisoHiperfoco(); } finally { document.hidden = false; }
  assert.equal(app.notified.length, 1);
  assert.match(app.toasts[0].m, /90 minutos/);
});

test('estimaciones: se aprende del foco real y se muestra en Ahora', () => {
  const app = fakeApp();
  const tarea = { id: 't1', title: 'Informe', effort: 'S' };
  assert.match(app.renderEstimacion(tarea), /~15 min/);
  assert.ok(!app.renderEstimacion(tarea).includes('sueles tardar'));
  assert.equal(app.renderEstimacion({ id: 'x', title: 'sin tamaño' }), '');

  // Menos de un minuto de foco o de otra tarea: no cuenta
  app._focoTarea = { id: 't1', ms: 30000 };
  app.registrarEstimacion(tarea);
  app._focoTarea = { id: 'otra', ms: 600000 };
  app.registrarEstimacion(tarea);
  assert.equal((app.state.estimaciones || []).length, 0);

  for (const min of [24, 30, 27]) {
    app._focoTarea = { id: 't1', ms: min * 60000 };
    app.registrarEstimacion(tarea);
  }
  assert.deepEqual(app.state.estimaciones.map(e => e.real), [24, 30, 27]);
  assert.equal(app._focoTarea, null);
  assert.match(app.renderEstimacion(tarea), /sueles tardar ~25/);
  assert.ok(!app.renderEstimacion({ id: 't2', title: 'Otra', effort: 'M' }).includes('sueles tardar'));
});

test('cierre del día: guarda las tres respuestas y alimenta el resumen de mañana', () => {
  const hoy = new Date();
  const app = fakeApp({
    focusSessions: [{ minutes: 25, at: hoy.toISOString() }],
    projects: [{ id: 'p1', name: 'Tesis', tasks: [{ title: 'Intro <i>x</i>', column: 'victorias', updatedAt: hoy.toISOString() }] }]
  });
  app.abrirCierreDia();
  const hoja = els['cierre-dia'].innerHTML;
  assert.match(hoja, /Hoy: 25 min de foco · 1 tarea cerrada/);
  assert.match(hoja, /Intro &lt;i&gt;x&lt;\/i&gt;/, 'lo hecho hoy se propone, escapado');
  assert.ok(comprobarAcciones(app, hoja) >= 2);

  els['cierre-hecho'] = Object.assign(new El(), { value: ' Intro ' });
  els['cierre-abierto'] = Object.assign(new El(), { value: '' });
  els['cierre-manana'] = Object.assign(new El(), { value: 'Llamar al banco' });
  app.guardarCierreDia();
  assert.equal(els['cierre-dia'], undefined);
  assert.equal(app.state.cierres.length, 1);
  assert.equal(app.cierreDeHoy().hecho, 'Intro');
  assert.match(app.toasts.at(-1).m, /Mañana empiezas por: Llamar al banco/);
  assert.equal(app.primeroDeHoy(), '', 'lo de hoy es para mañana, no para hoy');

  // Volver a cerrar el mismo día sustituye, no duplica; vacío no guarda nada
  app.abrirCierreDia();
  assert.match(els['cierre-dia'].innerHTML, />Llamar al banco<\/textarea>/);
  els['cierre-hecho'] = Object.assign(new El(), { value: 'Otra cosa' });
  els['cierre-abierto'] = new El();
  els['cierre-manana'] = new El();
  app.guardarCierreDia();
  assert.equal(app.state.cierres.length, 1);
  const vacio = fakeApp();
  vacio.abrirCierreDia();
  ['cierre-hecho', 'cierre-abierto', 'cierre-manana'].forEach(id => { els[id] = new El(); });
  vacio.guardarCierreDia();
  assert.equal(vacio.state.cierres, undefined);
});

test('revisión semanal: resumen en positivo, decisiones y foco de la semana', () => {
  const ahora = new Date().toISOString();
  const app = fakeApp({
    focusSessions: [{ minutes: 40, at: ahora }],
    pensadero: [{ category: 'humo_general' }, {}],
    projects: [
      { id: 'p1', name: 'Tesis', status: 'activo', lastActivity: ahora, tasks: [{ title: 'Capítulo 1', column: 'victorias', updatedAt: ahora }] },
      { id: 'p2', name: '<img src=x>', status: 'activo', lastActivity: '2020-01-01T00:00:00Z', tasks: [] }
    ]
  });
  app.abrirRevisionSemanal();
  let hoja = els['revision-semanal'].innerHTML;
  assert.match(hoja, /40 min de foco/);
  assert.match(hoja, /1 tarea cerrada/);
  assert.match(hoja, /2 pensamientos sin ordenar/);
  assert.match(hoja, /&lt;img src=x&gt;/);
  assert.ok(!hoja.includes('<img'));
  assert.ok(comprobarAcciones(app, hoja) >= 5);

  // Pausar un proyecto quieto conserva lo escrito en el paso 4 y repinta sin él
  els['revision-focos'] = Object.assign(new El(), { value: 'Entregar el capítulo 2' });
  app.revisionProyecto('pausar', 'p2');
  assert.deepEqual(app.calls.at(-1), ['pausar', 'p2']);
  hoja = els['revision-semanal'].innerHTML;
  assert.match(hoja, /Ninguno lleva más de dos semanas parado/);
  assert.match(hoja, />Entregar el capítulo 2<\/textarea>/);

  els['revision-focos'] = Object.assign(new El(), { value: 'Entregar el capítulo 2' });
  app.guardarRevisionSemanal();
  assert.equal(app.semanaActual().focos, 'Entregar el capítulo 2');
  assert.equal(els['revision-semanal'], undefined);

  app.abrirRevisionSemanal();
  els['revision-focos'] = Object.assign(new El(), { value: 'x' });
  app.revisionRepasar();
  assert.equal(app.calls.at(-1), 'review');
});

test('barra de rutinas en Ahora y recordatorios que no insisten', () => {
  const app = fakeApp();
  const barra = app.renderRutinasBar();
  assert.equal(typeof barra, 'string');
  assert.equal(comprobarAcciones(app, barra), 6);
  assert.match(barra, /aria-pressed="true"[^>]*>No</);

  // Ofrecer rutinas dos veces seguidas no repite el mismo aviso
  app.ofrecerRutinas();
  const primera = app.toasts.length;
  app.ofrecerRutinas();
  const dia = new Date().getDay();
  if (dia === 5 || dia === 6 || dia === 0) {
    assert.equal(primera, 1);
    assert.equal(app.toasts.length, 1);
  } else {
    assert.equal(app.toasts.length, primera);
  }
});
