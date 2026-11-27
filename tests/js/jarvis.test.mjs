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
const NotasCore = createRequire(import.meta.url)('../../js/notas-core.js');
const req = createRequire(import.meta.url);
const PasosCore = req('../../js/pasos-core.js');
const ModulosCore = req('../../js/modulos-core.js');
const HabitosCore = req('../../js/app/modulos/habitos.js');
const PersonasCore = req('../../js/app/modulos/personas.js');
const FinanzasCore = req('../../js/app/modulos/finanzas.js');
new Function('defineAppMethods', 'localStorage', 'html', 'NotasCore', 'PasosCore', 'HabitosCore', 'PersonasCore', 'FinanzasCore', src)(
  m => Object.assign(methods, m), localStorage, html, NotasCore, PasosCore, HabitosCore, PersonasCore, FinanzasCore);

function fakeApp() {
  const calls = [];
  let app;
  const project = { id: 'p1', name: 'CytoHelix', tasks: [{ id: 't1', title: 'Leer paper', column: 'proximo', effort: 'S' }] };
  app = Object.assign(Object.create(methods), {
    calls,
    state: { projects: [project], pensadero: [], notas: [] },
    listaNotas: () => app.state.notas,
    notaCambiada: (n, o) => calls.push(['notaCambiada', n.title, o]),
    refrescarNotas: () => {},
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

test('anadir_a_lista crea la lista, encuentra la existente y no duplica pendientes', () => {
  const app = fakeApp();
  assert.equal(run(app, 'anadir_a_lista', { lista: '', elementos: ['x'] }).is_error, true);
  assert.equal(run(app, 'anadir_a_lista', { lista: 'Compras', elementos: [] }).is_error, true);
  const r = run(app, 'anadir_a_lista', { lista: 'Compras', elementos: ['Pan', ' Leche ', ''] });
  assert.match(r.content, /Lista nueva Compras: Pan, Leche/);
  assert.equal(app.state.notas.length, 1);
  // "compra" encuentra "Compras"; «pan» ya está pendiente
  const r2 = run(app, 'anadir_a_lista', { lista: 'compra', elementos: ['pan', 'Huevos'] });
  assert.match(r2.content, /Añadido a Compras: Huevos/);
  assert.equal(app.state.notas.length, 1);
  assert.deepEqual(app.state.notas[0].items.map(i => i.text), ['Pan', 'Leche', 'Huevos']);
  assert.match(run(app, 'anadir_a_lista', { lista: 'Compras', elementos: ['PAN'] }).content, /Ya estaba todo/);
});

test('ver_listas y marcar_en_lista', () => {
  const app = fakeApp();
  assert.equal(run(app, 'ver_listas', { lista: null }).content, 'No hay listas.');
  run(app, 'anadir_a_lista', { lista: 'Compras', elementos: ['Pan integral', 'Leche'] });
  assert.equal(run(app, 'ver_listas', { lista: null }).content, 'Compras (2 pendientes)');
  assert.equal(run(app, 'ver_listas', { lista: 'compras' }).content, 'Compras: Pan integral; Leche');
  assert.equal(run(app, 'ver_listas', { lista: 'Viaje' }).is_error, true);

  assert.match(run(app, 'marcar_en_lista', { lista: 'Compras', elemento: 'pan', hecho: true }).content, /Hecho en Compras: Pan integral/);
  assert.equal(app.state.notas[0].items[0].done, true);
  assert.equal(run(app, 'marcar_en_lista', { lista: 'Compras', elemento: 'pan', hecho: true }).is_error, true, 'ya estaba hecho');
  assert.equal(run(app, 'ver_listas', { lista: 'Compras' }).content, 'Compras: Leche');
  assert.match(run(app, 'marcar_en_lista', { lista: 'Compras', elemento: 'pan', hecho: false }).content, /De vuelta a pendiente/);
  assert.equal(run(app, 'marcar_en_lista', { lista: 'Nada', elemento: 'pan', hecho: true }).is_error, true);
  // Una lista archivada o borrada no se toca
  app.state.notas[0].archived = true;
  assert.equal(run(app, 'marcar_en_lista', { lista: 'Compras', elemento: 'leche', hecho: true }).is_error, true);
});

test('el contexto de Jarvis incluye las listas', () => {
  const app = fakeApp();
  run(app, 'anadir_a_lista', { lista: 'Compras', elementos: ['Pan'] });
  assert.match(app.jarvisContext(true), /Listas: Compras \(1 pendientes\)/);
  assert.ok(!app.jarvisContext(false).includes('Listas:'));
});

// ---------------- Micro-pasos y módulos (Fases 20 y 26) ----------------
function appConModulos(encendidos = []) {
  const app = fakeApp();
  const docs = { habits: [], people: [], expenses: [] };
  Object.assign(app, {
    _guardarPasos: t => app.calls.push(['guardarPasos', t.id]),
    moduloActivo: id => encendidos.includes(id),
    modVivos: col => ModulosCore.vivos(docs[col]),
    modGuardar: (col, doc) => { docs[col] = [...docs[col].filter(d => d.id !== doc.id), doc]; return doc; },
    apuntarGasto: datos => { const g = FinanzasCore.crear(datos); if (g) docs.expenses.push(g); return g; },
    docs
  });
  return app;
}

test('partir_en_pasos añade pasos dentro de la tarea, sin duplicar', () => {
  const app = appConModulos();
  const tarea = app.state.projects[0].tasks[0];
  assert.equal(run(app, 'partir_en_pasos', { proyecto: null, tarea: 'no existe', pasos: ['a'] }).is_error, true);
  assert.equal(run(app, 'partir_en_pasos', { proyecto: null, tarea: 'paper', pasos: [] }).is_error, true);
  const r = run(app, 'partir_en_pasos', { proyecto: 'CytoHelix', tarea: 'leer paper', pasos: ['Abrir el PDF', 'Leer el resumen', '  '] });
  assert.equal(r.is_error, undefined);
  assert.match(r.content, /2 pasos añadidos a "Leer paper"\. El siguiente: Abrir el PDF/);
  assert.deepEqual(tarea.steps.map(s => [s.text, s.done]), [['Abrir el PDF', false], ['Leer el resumen', false]]);
  assert.match(run(app, 'partir_en_pasos', { proyecto: null, tarea: 'paper', pasos: ['abrir el pdf'] }).content, /ya estaban/);
  assert.match(run(app, 'ver_tareas', { proyecto: null }).content, /pasos 0\/2/);
});

test('marcar_paso marca el siguiente pendiente o el que se nombre', () => {
  const app = appConModulos();
  const tarea = app.state.projects[0].tasks[0];
  assert.match(run(app, 'marcar_paso', { tarea: 'paper', paso: null, hecho: true }).content, /no tiene pasos/);
  run(app, 'partir_en_pasos', { proyecto: null, tarea: 'paper', pasos: ['Abrir el PDF', 'Leer el resumen', 'Anotar tres ideas'] });
  assert.match(run(app, 'marcar_paso', { tarea: 'paper', paso: null, hecho: true }).content, /Paso hecho: Abrir el PDF \(1\/3\)\. Siguiente: Leer el resumen/);
  assert.match(run(app, 'marcar_paso', { tarea: 'paper', paso: 'ideas', hecho: true }).content, /Anotar tres ideas \(2\/3\)/);
  assert.equal(run(app, 'marcar_paso', { tarea: 'paper', paso: 'ideas', hecho: true }).is_error, true, 'ya estaba hecho');
  assert.match(run(app, 'marcar_paso', { tarea: 'paper', paso: 'abrir', hecho: false }).content, /de vuelta a pendiente/);
  assert.deepEqual(tarea.steps.map(s => s.done), [false, false, true]);
  run(app, 'marcar_paso', { tarea: 'paper', paso: null, hecho: true });
  assert.match(run(app, 'marcar_paso', { tarea: 'paper', paso: null, hecho: true }).content, /Todos los pasos hechos/);
});

test('las herramientas de módulos solo funcionan con el módulo encendido', () => {
  const apagado = appConModulos([]);
  for (const [nombre, input] of [['marcar_habito', { habito: 'Agua', hecho: true }], ['apuntar_gasto', { cantidad: 65, concepto: 'café' }], ['registrar_contacto', { persona: 'Ana' }]]) {
    const r = run(apagado, nombre, input);
    assert.equal(r.is_error, true);
    assert.match(r.content, /apagado/);
  }
  assert.ok(!apagado.jarvisContext(true).includes('Hábitos:'));

  const app = appConModulos(['habitos', 'personas', 'finanzas']);
  app.docs.habits.push(HabitosCore.crear({ name: 'Agua' }));
  app.docs.people.push(PersonasCore.crear({ name: 'Ana', everyDays: 7 }));
  const contexto = app.jarvisContext(true);
  assert.match(contexto, /Hábitos: Agua/);
  assert.match(contexto, /Personas: Ana/);

  assert.match(run(app, 'marcar_habito', { habito: 'agua', hecho: true }).content, /Hecho hoy: Agua/);
  assert.equal(HabitosCore.hecho(app.docs.habits[0], HabitosCore.claveDia(Date.now())), true);
  assert.equal(run(app, 'marcar_habito', { habito: 'yoga', hecho: true }).is_error, true);

  assert.match(run(app, 'apuntar_gasto', { cantidad: 65, concepto: 'café' }).content, /\$65 en café\. Esta semana: \$65/);
  assert.equal(run(app, 'apuntar_gasto', { cantidad: 0, concepto: 'nada' }).is_error, true);

  assert.match(run(app, 'registrar_contacto', { persona: 'ana' }).content, /hoy hablaste con Ana/);
  assert.ok(app.docs.people[0].lastContactAt);
  assert.equal(run(app, 'registrar_contacto', { persona: 'Zoe' }).is_error, true);
});
