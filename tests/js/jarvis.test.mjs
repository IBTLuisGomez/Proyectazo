// Ejecutar: node --test tests/js
// Prueba las herramientas de Jarvis sobre un "this" falso, sin navegador.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../../js/app/features/jarvis.js', import.meta.url), 'utf8');
const methods = {};
const store = new Map();
const localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
import { createRequire } from 'node:module';
const { html } = createRequire(import.meta.url)('../../js/app/ui/html.js');
new Function('defineAppMethods', 'localStorage', 'html', src)(m => Object.assign(methods, m), localStorage, html);

function fakeApp() {
  const calls = [];
  let app;
  const project = { id: 'p1', name: 'CytoHelix', tasks: [{ id: 't1', title: 'Leer paper', column: 'proximo', effort: 'S' }] };
  app = Object.assign(Object.create(methods), {
    calls,
    state: { projects: [project], pensadero: [] },
    timer: { isRunning: false },
    backendAvailable: false,
    findProjectMatch: name => (/cyto/i.test(name) ? { project } : null),
    captureThought: (t, o) => { calls.push(['captureThought', t, o]); return [app.nextCapture || { id: 'n1', content: t, dueAt: o.dueAt }]; },
    addTaskFromCapture: (p, parsed) => calls.push(['addTask', p.name, parsed]),
    quickDumpToOrbe: (t, c, x) => { calls.push(['dump', t, c, x]); return { item: { id: 'n1' }, created: Promise.resolve() }; },
    scheduleCaptureReminder: () => calls.push(['reminder']),
    formatDue: iso => iso.slice(0, 10),
    setTimerDuration: m => calls.push(['timer', m]),
    startPauseTimer: () => calls.push(['start']),
    navigate: v => calls.push(['navigate', v]),
    closeJarvis: () => {}
  });
  return app;
}

const run = (app, name, input) => app.runJarvisTool({ id: 'x', name, input });

test('soltar_pensamiento traduce la categoría visible a la clave guardada', () => {
  const app = fakeApp();
  const r = run(app, 'soltar_pensamiento', { texto: 'comprar pan', categoria: 'vida' });
  assert.equal(r.is_error, undefined);
  assert.equal(app.calls[0][2].category, 'humo_verde');
  run(app, 'soltar_pensamiento', { texto: 'algo', categoria: 'auto' });
  assert.equal(app.calls[1][2].category, undefined);
});

test('crear_tarea valida proyecto y fecha y pasa el tamaño', () => {
  const app = fakeApp();
  assert.equal(run(app, 'crear_tarea', { proyecto: 'Nada', titulo: 'x', tamano: 'S', para_cuando: null }).is_error, true);
  assert.equal(run(app, 'crear_tarea', { proyecto: 'CytoHelix', titulo: 'x', tamano: 'S', para_cuando: 'mañana' }).is_error, true);
  const ok = run(app, 'crear_tarea', { proyecto: 'cytohelix', titulo: 'Escribir intro', tamano: 'M', para_cuando: '2030-01-02T10:00:00+01:00' });
  assert.equal(ok.is_error, undefined);
  const [, name, parsed] = app.calls.at(-1);
  assert.equal(name, 'CytoHelix');
  assert.equal(parsed.effort, 'M');
  assert.equal(parsed.dueAt, '2030-01-02T09:00:00.000Z');
});

test('programar_aviso rechaza horas pasadas y programa las futuras', () => {
  const app = fakeApp();
  assert.equal(run(app, 'programar_aviso', { texto: 'x', cuando: '2000-01-01T00:00:00Z' }).is_error, true);
  const r = run(app, 'programar_aviso', { texto: 'llamar al banco', cuando: '2030-01-01T09:00:00Z' });
  assert.equal(r.is_error, undefined);
  const [name, , opts] = app.calls[0];
  assert.equal(name, 'captureThought');
  assert.equal(opts.category, 'humo_rojo');
  assert.equal(opts.dueAt, '2030-01-01T09:00:00.000Z');
});

test('recordar_dato guarda sin duplicar y empezar_foco limita minutos', () => {
  const app = fakeApp();
  run(app, 'recordar_dato', { dato: 'Trabaja mejor por la mañana' });
  run(app, 'recordar_dato', { dato: 'Trabaja mejor por la mañana' });
  assert.equal(JSON.parse(store.get('nexus_jarvis_memoria')).length, 1);
  assert.equal(run(app, 'empezar_foco', { minutos: 500 }).is_error, true);
  run(app, 'empezar_foco', { minutos: 10 });
  assert.deepEqual(app.calls.map(c => c[0]), ['timer', 'start', 'navigate']);
});

test('herramienta desconocida devuelve error, no excepción', () => {
  assert.equal(run(fakeApp(), 'borrar_todo', {}).is_error, true);
});

test('soltar_pensamiento informa lo que pasó de verdad', () => {
  const app = fakeApp();
  app.nextCapture = { id: 't9', kind: 'task', projectName: 'CytoHelix' };
  assert.match(run(app, 'soltar_pensamiento', { texto: 'para cyto: x', categoria: 'auto' }).content, /tarea en CytoHelix/);
  app.nextCapture = { id: 'n2', content: 'pan', count: 3 };
  assert.match(run(app, 'soltar_pensamiento', { texto: 'pan', categoria: 'auto' }).content, /Ya estaba apuntado/);
});

test('programar_aviso falla si el pensamiento no quedó con fecha', () => {
  const app = fakeApp();
  app.nextCapture = { id: 'n3', content: 'banco' }; // p. ej. repetido sin dueAt
  assert.equal(run(app, 'programar_aviso', { texto: 'banco', cuando: '2030-01-01T09:00:00Z' }).is_error, true);
});

test('el resumen del día escapa nombres y conserva el formato', () => {
  const app = fakeApp();
  app.state.projects[0].name = '<img src=x onerror=alert(1)>';
  app.state.projects[0].status = 'activo';
  app.state.projects[0].lastActivity = '2020-01-01T00:00:00Z';
  Object.assign(app, {
    dueItems: () => [{ title: 'Pagar <b>luz</b>' }],
    getEnergyToday: () => 'media',
    ahoraCandidates: p => p.tasks,
    daysSince: () => 30
  });
  const out = String(app.buildBriefing());
  assert.ok(!out.includes('<img') && !out.includes('<b>'));
  assert.match(out, /&lt;img src=x/);
  assert.match(out, /<strong>/);
  assert.match(out, /<br>/);
});
