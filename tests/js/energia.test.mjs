// Energía del día, «¿qué cabe ahora?» e incubadora (Fases 17-19): lógica y su interfaz sobre un DOM mínimo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { html, raw, accion } = require('../../js/app/ui/html.js');
const EnergiaCore = require('../../js/energia-core.js');
const FocoCore = require('../../js/foco-core.js');
const ModulosCore = require('../../js/modulos-core.js');

const DIA = 864e5;
const AHORA = new Date(2026, 10, 27, 10, 0, 0).getTime();
const FIN_HOY = new Date(2026, 10, 27, 23, 59, 59).getTime();
const iso = ms => new Date(ms).toISOString();

test('peso de una tarea: tamaño más micro-pasos pendientes', () => {
  assert.equal(EnergiaCore.pesoTarea({ effort: 'XS' }), 0.5);
  assert.equal(EnergiaCore.pesoTarea({ effort: 'L' }), 3);
  assert.equal(EnergiaCore.pesoTarea({}), 1, 'sin tamaño cuenta como S');
  assert.equal(EnergiaCore.pesoTarea({ effort: 'M', steps: [{ done: true }, { done: false }, { done: false }] }), 2.5);
  assert.equal(EnergiaCore.pesoTarea(null), 0);
});

test('tareas de hoy: en foco o con fecha hasta hoy; nada del Baúl, hibernado o terminado', () => {
  const projects = [
    { id: 'p1', name: 'Tesis', tasks: [
      { id: 'a', column: 'enfoco', effort: 'M' },
      { id: 'b', column: 'buzon', effort: 'S', dueAt: iso(AHORA + 3600e3) },
      { id: 'c', column: 'buzon', effort: 'S', dueAt: iso(AHORA + 2 * DIA) },
      { id: 'd', column: 'victorias', effort: 'L', dueAt: iso(AHORA) },
      { id: 'e', column: 'proximo', effort: 'L' },
      { id: 'f', column: 'buzon', effort: 'XS', dueAt: iso(AHORA - 3 * DIA) }
    ] },
    { id: 'p2', name: 'Secreto', inBaul: true, tasks: [{ id: 'x', column: 'enfoco', effort: 'L' }] },
    { id: 'p3', name: 'Dormido', status: 'hibernado', tasks: [{ id: 'y', column: 'enfoco', effort: 'L' }] }
  ];
  const hoy = EnergiaCore.tareasDeHoy(projects, FIN_HOY);
  assert.deepEqual(hoy.map(x => x.task.id), ['a', 'b', 'f']);
  assert.deepEqual(hoy.map(x => x.peso), [2, 1, 0.5]);
});

test('medidor: capacidad por energía, y pasarse se señala sin bloquear', () => {
  const tareas = [{ peso: 2 }, { peso: 1 }, { peso: 0.5 }];
  assert.deepEqual(EnergiaCore.medidor(tareas, 'media'), { nivel: 'media', capacidad: 6, carga: 3.5, restante: 2.5, pct: 58, pasado: false });
  const baja = EnergiaCore.medidor(tareas, 'baja');
  assert.equal(baja.pasado, true);
  assert.equal(baja.restante, 0);
  assert.equal(baja.pct, 100);
  assert.equal(EnergiaCore.medidor([], 'no-sé').capacidad, 6, 'un nivel desconocido cuenta como media');
  assert.equal(EnergiaCore.medidor([], 'alta').capacidad, 9);
});

test('¿qué cabe ahora?: primero lo que cabe, sin cambiar el orden que traía', () => {
  const tareas = [{ id: 'g', effort: 'L' }, { id: 'p', effort: 'XS' }, { id: 'm', effort: 'M' }, { id: 's', effort: 'S' }];
  assert.deepEqual(EnergiaCore.ordenarPorCabida(tareas, 1).map(t => t.id), ['p', 's', 'g', 'm']);
  assert.deepEqual(EnergiaCore.ordenarPorCabida(tareas, 9).map(t => t.id), ['g', 'p', 'm', 's']);
  // Lo que ya está contado en la carga de hoy siempre cabe
  assert.deepEqual(EnergiaCore.ordenarPorCabida(tareas, 0, ['g']).map(t => t.id), ['g', 'p', 'm', 's']);
});

test('energía por día: un documento por fecha', () => {
  const doc = EnergiaCore.docEnergia('2026-11-27', 'alta', iso(AHORA));
  assert.deepEqual(doc, { id: '2026-11-27', level: 'alta', updatedAt: iso(AHORA) });
  assert.equal(EnergiaCore.nivelDe([doc], '2026-11-27'), 'alta');
  assert.equal(EnergiaCore.nivelDe([doc], '2026-11-28'), null);
  assert.equal(EnergiaCore.nivelDe([{ ...doc, deleted: true }], '2026-11-27'), null);
  assert.equal(EnergiaCore.docEnergia('2026-11-27', 'turbo').level, 'media');
});

test('incubadora: solo Buzón y Próximo sin fecha que llevan 14 días quietos', () => {
  const viejo = iso(AHORA - 20 * DIA);
  const projects = [
    { id: 'p1', name: 'Tesis', tasks: [
      { id: 'a', title: 'Vieja', column: 'buzon', updatedAt: viejo },
      { id: 'b', title: 'En foco', column: 'enfoco', updatedAt: viejo },
      { id: 'c', title: 'Con fecha', column: 'proximo', updatedAt: viejo, dueAt: iso(AHORA + DIA) },
      { id: 'd', title: 'Reciente', column: 'proximo', updatedAt: iso(AHORA - 13 * DIA) },
      { id: 'e', title: 'Más vieja', column: 'proximo', createdAt: iso(AHORA - 40 * DIA) },
      { id: 'f', title: 'Sin fechas', column: 'buzon' }
    ] },
    { id: 'p2', name: 'Secreto', inBaul: true, tasks: [{ id: 'x', title: 'x', column: 'buzon', updatedAt: viejo }] }
  ];
  const lista = FocoCore.incubables(projects, AHORA);
  assert.deepEqual(lista.map(x => [x.taskId, x.dias]), [['e', 40], ['a', 20]]);
  assert.deepEqual(FocoCore.incubadas([{ id: 'p', name: 'P', tasks: [{ id: 'z', title: 'Z', column: 'congelador', incubatedAt: viejo }, { id: 'w', column: 'congelador' }] }]).map(x => x.taskId), ['z']);
});

// ---------------- Interfaz (js/app/features/energia.js) ----------------
class El {
  constructor() { this.attrs = {}; this._html = ''; }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = String(v); }
  setAttribute(k, v) { this.attrs[k] = v; }
  addEventListener() {}
  remove() { for (const k of Object.keys(els)) if (els[k] === this) delete els[k]; }
}
let els = {};
const document = { getElementById: id => els[id] || null, createElement: () => new El(), body: { appendChild: el => { els[el.id] = el; } } };
const store = new Map();
const localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
const methods = {};
const cargar = (ruta, extra = {}) => {
  const src = readFileSync(new URL(ruta, import.meta.url), 'utf8');
  const nombres = ['defineAppMethods', 'html', 'raw', 'accion', 'EnergiaCore', 'FocoCore', 'ModulosCore', 'document', 'localStorage', ...Object.keys(extra)];
  new Function(...nombres, src)(m => Object.assign(methods, m), html, raw, accion, EnergiaCore, FocoCore, ModulosCore, document, localStorage, ...Object.values(extra));
};
cargar('../../js/app/features/modulos.js');
cargar('../../js/app/features/energia.js');

function fakeApp(state = {}) {
  els = {};
  store.clear();
  return Object.assign(Object.create(methods), {
    state: { settings: {}, projects: [], ...state },
    currentView: 'ahora', toasts: [], saved: 0, energia: 'media', snoozed: [],
    saveState() { this.saved++; },
    showToast(m, cb, label) { this.toasts.push({ m, cb, label }); },
    render() {},
    endOfToday: () => Date.now() + 12 * 3600e3,
    getEnergyToday() { return this.energia; },
    _tareaPorId(pid, tid) {
      const project = this.state.projects.find(p => p.id === pid);
      const task = project && project.tasks.find(t => t.id === tid);
      return task ? { project, task } : null;
    },
    snoozeDueItem(kind, id) { this.snoozed.push(id); },
    abrirHoja(id, contenido) { const el = new El(); el.id = id; el.innerHTML = contenido; els[id] = el; return el; },
    cerrarHoja(id) { delete els[id]; },
    guardarFocosSemana() {}, abrirRevisionSemanal() { this.revision = (this.revision || 0) + 1; }
  });
}

function comprobarAcciones(app, texto) {
  const des = s => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
  let n = 0;
  for (const m of String(texto).matchAll(/data-on-[a-z]+="([^"]*)"/g)) {
    assert.equal(typeof app[JSON.parse(des(m[1]))[0]], 'function', `método ${m[1]}`);
    n++;
  }
  return n;
}

test('medidor en Ahora: tranquilo cuando cabe, ámbar y con salida cuando no', () => {
  const app = fakeApp({ projects: [{ id: 'p1', name: 'Tesis <b>', tasks: [
    { id: 'a', title: 'Capítulo', column: 'enfoco', effort: 'L' },
    { id: 'b', title: 'Revisar', column: 'enfoco', effort: 'M' }
  ] }] });
  assert.equal(fakeApp().renderMedidorEnergia(), '', 'sin nada para hoy no se pinta');
  let barra = app.renderMedidorEnergia();
  assert.match(barra, /5 de 6 puntos de energía usados hoy/);
  assert.ok(!barra.includes('Mover algo'));
  app.energia = 'baja';
  barra = app.renderMedidorEnergia();
  assert.match(barra, /Hoy llevas 5 de 3 puntos/);
  assert.match(barra, /bg-amber-400/);
  assert.ok(!/rose|red-/.test(barra), 'nunca rojo');
  assert.equal(comprobarAcciones(app, barra), 1);

  app.abrirAligerarHoy();
  const hoja = els['aligerar-hoy'].innerHTML;
  assert.match(hoja, /Tesis &lt;b&gt;/);
  assert.equal(comprobarAcciones(app, hoja), 3);
  app.aligerarTarea('p1', 'a');
  assert.equal(app.state.projects[0].tasks[0].column, 'proximo', 'sin fecha: sale del foco');
  assert.ok(app.state.projects[0].updatedAt, 'el proyecto queda marcado para sincronizar');
  app.state.projects[0].tasks[1].dueAt = new Date().toISOString();
  app.aligerarTarea('p1', 'b');
  assert.deepEqual(app.snoozed, ['b'], 'con fecha: pasa a mañana');
});

test('qué cabe ahora: reordena las candidatas y avisa si la propuesta es grande', () => {
  const app = fakeApp({ projects: [{ id: 'p1', name: 'P', tasks: [{ id: 'hoy', title: 'Hoy', column: 'enfoco', effort: 'L' }] }] });
  app.energia = 'baja'; // capacidad 3, ya gastada
  const candidatas = [{ id: 'g', effort: 'M' }, { id: 'hoy', effort: 'L' }, { id: 'p', effort: 'XS' }];
  assert.deepEqual(app.ordenarPorEnergia(candidatas).map(t => t.id), ['hoy', 'g', 'p'], 'no queda energía: solo lo ya contado va delante');
  assert.match(app.renderCabida({ id: 'g', effort: 'M' }), /grande para la energía/);
  assert.equal(app.renderCabida({ id: 'hoy', effort: 'L' }), '');
  assert.equal(app.renderCabida({ id: 'task-temp' }), '');
  app.energia = 'alta';
  assert.equal(app.renderCabida({ id: 'g', effort: 'M' }), '');
});

test('la energía dicha hoy se guarda como documento sincronizable', () => {
  const app = fakeApp();
  assert.equal(app.energiaGuardadaHoy(), null);
  app.guardarEnergiaDia('alta');
  assert.equal(app.energiaGuardadaHoy(), 'alta');
  app.guardarEnergiaDia('baja');
  assert.equal(app.state.modulos.energy.length, 1, 'un documento por día');
  assert.equal(app.energiaGuardadaHoy(), 'baja');
  assert.deepEqual(Object.keys(app.cambiosDeModulos(0)), ['energy']);
});

test('incubadora: una vez al día, con deshacer, y decisión en la revisión semanal', () => {
  const viejo = new Date(Date.now() - 30 * DIA).toISOString();
  const app = fakeApp({ projects: [{ id: 'p1', name: 'Tesis', tasks: [
    { id: 'a', title: 'Olvidada <i>', column: 'proximo', updatedAt: viejo },
    { id: 'b', title: 'Otra', column: 'buzon', updatedAt: viejo },
    { id: 'c', title: 'Viva', column: 'buzon', updatedAt: new Date().toISOString() }
  ] }] });
  const [a, b, c] = app.state.projects[0].tasks;
  assert.equal(app.incubarAutomatico().length, 2);
  assert.deepEqual([a.column, b.column, c.column], ['congelador', 'congelador', 'buzon']);
  assert.equal(a.incubatedFrom, 'proximo');
  assert.match(app.toasts[0].m, /2 tareas llevaban dos semanas/);
  assert.equal(app.incubarAutomatico().length, 0, 'el mismo día no repite');

  const paso = String(app.renderIncubadoraRevision());
  assert.match(paso, /Olvidada &lt;i&gt;/);
  assert.equal(comprobarAcciones(app, paso), 4);
  els['revision-semanal'] = new El();
  app.rescatarIncubada('p1', 'a');
  assert.equal(a.column, 'proximo');
  assert.equal(a.incubatedAt, undefined);
  assert.equal(app.revision, 1, 'la revisión se repinta');
  app.soltarIncubada('p1', 'b');
  assert.equal(b.column, 'congelador');
  assert.match(String(app.renderIncubadoraRevision()), /Nada esperando/);

  // Deshacer desde el aviso devuelve todo a su columna
  const otra = fakeApp({ projects: [{ id: 'p1', name: 'T', tasks: [{ id: 'z', title: 'Z', column: 'buzon', updatedAt: viejo }] }] });
  otra.incubarAutomatico();
  otra.toasts[0].cb();
  assert.equal(otra.state.projects[0].tasks[0].column, 'buzon');
});
