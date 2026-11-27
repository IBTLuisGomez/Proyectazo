// Módulos opcionales (Fases 21-24): registro, mezcla entre dispositivos, Hábitos, Personas y Finanzas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { html, raw, accion } = require('../../js/app/ui/html.js');
const ModulosCore = require('../../js/modulos-core.js');
const HabitosCore = require('../../js/app/modulos/habitos.js');
const PersonasCore = require('../../js/app/modulos/personas.js');
const FinanzasCore = require('../../js/app/modulos/finanzas.js');

const DIA = 864e5;
const T = n => `2026-01-01T${String(10 + n).padStart(2, '0')}:00:00.000Z`;
// Viernes 27 de noviembre de 2026, a mediodía (hora local)
const AHORA = new Date(2026, 10, 27, 12, 0, 0).getTime();
const clave = n => HabitosCore.claveDia(AHORA - n * DIA);

// ---------------- Registro y mezcla ----------------
test('registro: ids únicos, colecciones conocidas y apagado por defecto', t => {
  // El registro es global: se guardan los módulos reales (cargados más abajo) y se devuelven al terminar
  const reales = ModulosCore.lista();
  t.after(() => { ModulosCore.reiniciar(); reales.forEach(m => ModulosCore.registrar(m)); });
  ModulosCore.reiniciar();
  const m = ModulosCore.registrar({ id: 'habitos', nombre: 'Hábitos', icono: '🌱', coleccion: 'habits', render: 'renderViewHabitos' });
  assert.equal(m.vista, 'mod-habitos');
  assert.throws(() => ModulosCore.registrar({ id: 'habitos' }), /duplicado/);
  assert.throws(() => ModulosCore.registrar({ id: 'X y' }), /id válido/);
  assert.throws(() => ModulosCore.registrar({ id: 'otro', coleccion: 'secretos' }), /desconocida/);
  ModulosCore.registrar({ id: 'siempre', activoPorDefecto: true });
  assert.deepEqual(ModulosCore.vistas(), ['mod-habitos'], 'sin ficha no hay vista');
  assert.equal(ModulosCore.activo({}, 'habitos'), false);
  assert.equal(ModulosCore.activo({ modulos: { habitos: true } }, 'habitos'), true);
  assert.equal(ModulosCore.activo({ modulos: { siempre: false } }, 'siempre'), false);
  assert.equal(ModulosCore.activo(undefined, 'siempre'), true);
  assert.equal(ModulosCore.activo({}, 'no-existe'), false);
  assert.equal(ModulosCore.porVista('mod-habitos').id, 'habitos');
});

test('mezcla: gana el documento más reciente y lo borrado no resucita', () => {
  const local = [{ id: 'a', name: 'Agua', updatedAt: T(1) }, { id: 'b', name: 'Leer', updatedAt: T(3) }];
  const remoto = [{ id: 'a', name: 'Agua con limón', updatedAt: T(2) }, { id: 'b', deleted: true, updatedAt: T(2) }, { id: 'c', name: 'Nuevo', updatedAt: T(1) }];
  const out = ModulosCore.mezclar(local, remoto);
  assert.deepEqual(out.map(d => [d.id, d.name]), [['a', 'Agua con limón'], ['b', 'Leer'], ['c', 'Nuevo']]);
  const borrado = ModulosCore.mezclar(local, [{ id: 'b', deleted: true, updatedAt: T(4) }]);
  assert.equal(ModulosCore.vivos(borrado).length, 1);
  assert.equal(ModulosCore.mezclar(borrado, local).find(d => d.id === 'b').deleted, true, 'una copia vieja no lo devuelve');
});

test('mezcla de marcas: cada día por separado', () => {
  const movil = { id: 'h', name: 'Agua', updatedAt: T(3), marks: { '2026-01-02': { done: true, at: T(3) } } };
  const pc = { id: 'h', name: 'Agua', updatedAt: T(2), marks: { '2026-01-01': { done: true, at: T(2) }, '2026-01-02': { done: false, at: T(1) } } };
  for (const [a, b] of [[movil, pc], [pc, movil]]) {
    const [h] = ModulosCore.mezclar([a], [b]);
    assert.deepEqual(h.marks, { '2026-01-01': { done: true, at: T(2) }, '2026-01-02': { done: true, at: T(3) } });
  }
});

test('lo cambiado desde la última sincronización, solo de colecciones conocidas', () => {
  const estado = { habits: [{ id: 'a', updatedAt: T(1) }, { id: 'b', updatedAt: T(5) }], otra: [{ id: 'x', updatedAt: T(9) }], energy: [] };
  assert.deepEqual(ModulosCore.cambiados(estado, new Date(T(2)).getTime()), { habits: [{ id: 'b', updatedAt: T(5) }] });
  assert.equal(ModulosCore.cambiados(estado, 0).habits.length, 2);
  const mezclado = ModulosCore.mezclarEstado({ habits: [{ id: 'a', updatedAt: T(1) }] }, { habits: [{ id: 'z', updatedAt: T(1) }], intruso: [{ id: 'q' }] });
  assert.deepEqual(mezclado.habits.map(d => d.id), ['a', 'z']);
  assert.deepEqual(mezclado.people, []);
  assert.equal(mezclado.intruso, undefined);
});

// ---------------- Hábitos ----------------
test('hábitos: crear, días que toca y marcar', () => {
  assert.equal(HabitosCore.crear({ name: '  ' }), null);
  const h = HabitosCore.crear({ name: ' Agua ', days: [1, 3, 5, 9, '5'] }, T(0));
  assert.deepEqual([h.name, h.emoji, h.days], ['Agua', '🌱', [1, 3, 5]]);
  assert.deepEqual(HabitosCore.crear({ name: 'x', days: [0, 1, 2, 3, 4, 5, 6] }).days, [], 'los siete días es «todos»');
  assert.equal(HabitosCore.toca(h, AHORA), true, 'el 27-11-2026 es viernes');
  assert.equal(HabitosCore.toca(h, AHORA + DIA), false);
  const m = HabitosCore.marcar(h, clave(0), true, new Date(AHORA).toISOString());
  assert.equal(HabitosCore.hecho(m, clave(0)), true);
  assert.equal(HabitosCore.hecho(h, clave(0)), false, 'no muta el original');
  assert.equal(HabitosCore.textoDias(h), 'L · X · V');
  assert.equal(HabitosCore.textoDias({ days: [] }), 'Todos los días');
});

test('racha flexible: un día sin hacerlo no la rompe, dos seguidos sí', () => {
  const con = dias => ({ days: [], marks: Object.fromEntries(dias.map(n => [clave(n), { done: true, at: T(0) }])) });
  assert.equal(HabitosCore.racha(con([0, 1, 2]), AHORA), 3);
  assert.equal(HabitosCore.racha(con([1, 2, 3]), AHORA), 3, 'hoy aún sin hacer no cuenta en contra');
  assert.equal(HabitosCore.racha(con([0, 1, 3, 4]), AHORA), 4, 'un hueco se perdona');
  assert.equal(HabitosCore.racha(con([0, 1, 4, 5]), AHORA), 2, 'dos huecos seguidos la cortan');
  assert.equal(HabitosCore.racha(con([]), AHORA), 0);
  // Solo lunes, miércoles y viernes: los días que no tocan no cuentan como fallo
  const lmv = { days: [1, 3, 5], marks: Object.fromEntries([0, 2, 4, 7].map(n => [clave(n), { done: true, at: T(0) }])) };
  assert.equal(HabitosCore.racha(lmv, AHORA), 4);
  assert.equal(HabitosCore.hechosEn(con([0, 1, 3, 9]), AHORA, 7), 3);
  const mapa = HabitosCore.mapa(con([0, 27]), AHORA, 28);
  assert.equal(mapa.length, 28);
  assert.deepEqual([mapa[0].done, mapa[1].done, mapa[27].done], [true, false, true]);
});

test('hábitos pendientes hoy y búsqueda por nombre', () => {
  const agua = HabitosCore.marcar(HabitosCore.crear({ name: 'Agua' }), clave(0), true);
  const leer = HabitosCore.crear({ name: 'Leer 10 páginas' });
  const sabado = HabitosCore.crear({ name: 'Mercado', days: [6] });
  const borrado = { ...HabitosCore.crear({ name: 'Viejo' }), deleted: true };
  assert.deepEqual(HabitosCore.pendientesHoy([agua, leer, sabado, borrado], AHORA).map(h => h.name), ['Leer 10 páginas']);
  assert.equal(HabitosCore.buscar([agua, leer], 'leer').name, 'Leer 10 páginas');
  assert.equal(HabitosCore.buscar([agua, leer], 'AGUA').name, 'Agua');
  assert.equal(HabitosCore.buscar([agua, borrado], 'viejo'), null);
});

// ---------------- Personas ----------------
test('personas: contacto pendiente y cumpleaños cercanos', () => {
  const hace = n => new Date(AHORA - n * DIA).toISOString();
  const ana = PersonasCore.crear({ name: 'Ana', everyDays: 30, lastContactAt: hace(45) }, hace(100));
  const luis = PersonasCore.crear({ name: 'Luis', everyDays: 30, lastContactAt: hace(10) }, hace(100));
  const eva = PersonasCore.crear({ name: 'Eva', birthday: '2001-11-30', everyDays: 7, lastContactAt: hace(60) }, hace(100));
  const sin = PersonasCore.crear({ name: 'Sin aviso', everyDays: 5, lastContactAt: hace(400) }, hace(500));
  assert.equal(eva.birthday, '11-30');
  assert.equal(sin.everyDays, 0, 'solo los intervalos ofrecidos');
  assert.equal(PersonasCore.limpiarCumple('13-40'), '');
  assert.equal(PersonasCore.diasSinContacto(ana, AHORA), 45);
  assert.equal(PersonasCore.tocaContactar(ana, AHORA), true);
  assert.equal(PersonasCore.tocaContactar(luis, AHORA), false);
  assert.equal(PersonasCore.diasParaCumple(eva, AHORA), 3);
  assert.equal(PersonasCore.diasParaCumple({ birthday: '11-27' }, AHORA), 0);
  assert.equal(PersonasCore.diasParaCumple({ birthday: '11-26' }, AHORA), 364);
  const s = PersonasCore.sugerencias([ana, luis, eva, sin], AHORA);
  assert.deepEqual(s.map(x => [x.id === eva.id ? 'eva' : 'ana', x.tipo]), [['eva', 'cumple'], ['ana', 'contacto']]);
  assert.match(s[0].texto, /Cumpleaños de Eva en 3 días/);
  assert.match(s[1].texto, /Hace 45 días que no hablas con Ana/);
  const despues = PersonasCore.registrarContacto(ana, new Date(AHORA).toISOString());
  assert.equal(PersonasCore.tocaContactar(despues, AHORA), false);
  assert.equal(PersonasCore.buscar([ana, luis], 'lu').name, 'Luis');
});

// ---------------- Finanzas ----------------
test('finanzas: entiende «café 65» y «gasté 200 en super», y no confunde lo demás', () => {
  assert.deepEqual(FinanzasCore.interpretar('café 65'), { amount: 65, note: 'café' });
  assert.deepEqual(FinanzasCore.interpretar('uber $120.50'), { amount: 120.5, note: 'uber' });
  assert.deepEqual(FinanzasCore.interpretar('Gasté 200 en super'), { amount: 200, note: 'super' });
  assert.deepEqual(FinanzasCore.interpretar('pagué $1,200.50 de luz'), { amount: 1200.5, note: 'luz' });
  assert.deepEqual(FinanzasCore.interpretar('compré 80 pesos pan'), { amount: 80, note: 'pan' });
  assert.deepEqual(FinanzasCore.interpretar('gasté 50'), { amount: 50, note: 'Gasto' });
  for (const no of ['llamar a Ana a las 5', 'reunión 10', 'comprar pan', 'leer capítulo 3', 'una idea muy larga para el proyecto 2', '', 'café 0']) {
    assert.equal(FinanzasCore.interpretar(no), null, no);
  }
  assert.equal(FinanzasCore.interpretar('café 65', { estricto: true }), null, 'en Soltar solo con verbo');
  assert.ok(FinanzasCore.interpretar('gasté 65 en café', { estricto: true }));
  assert.equal(FinanzasCore.categoria('café con Ana'), 'comida');
  assert.equal(FinanzasCore.categoria('uber'), 'transporte');
  assert.equal(FinanzasCore.categoria('cosa rara'), 'otros');
});

test('finanzas: totales de la semana y del mes, por categoría', () => {
  const g = (amount, note, diasAtras, extra = {}) => ({ ...FinanzasCore.crear({ amount, note }, new Date(AHORA - diasAtras * DIA).toISOString()), ...extra });
  const gastos = [g(65, 'café', 0), g(200, 'super', 2), g(120, 'uber', 10, { impulse: true }), g(999, 'viejo', 40), g(50, 'borrado', 0, { deleted: true })];
  const t = FinanzasCore.totales(gastos, AHORA);
  assert.equal(t.semana, 265);
  assert.equal(t.mes, 385);
  assert.equal(t.impulsos, 120);
  assert.deepEqual(t.porCategoria.map(c => [c.categoria, c.total]), [['comida', 265], ['transporte', 120]]);
  assert.equal(FinanzasCore.crear({ amount: -5 }), null);
  assert.equal(FinanzasCore.esAlto(500), true);
  assert.equal(FinanzasCore.esAlto(499), false);
  assert.equal(FinanzasCore.esAlto(100, 80), true);
  assert.deepEqual(FinanzasCore.recientes(gastos, 2).map(x => x.note), ['café', 'super']);
});

// ---------------- Interfaz sobre un DOM mínimo ----------------
class El {
  constructor(value = '') { this.value = value; this._html = ''; }
  get innerHTML() { return this._html; }
  set innerHTML(v) { this._html = String(v); }
  focus() {}
}
let els = {};
let marcados = [];
const document = { getElementById: id => els[id] || null, querySelectorAll: () => marcados };
const methods = {};
ModulosCore.reiniciar();
for (const ruta of ['../../js/app/features/modulos.js', '../../js/app/modulos/habitos.js', '../../js/app/modulos/personas.js', '../../js/app/modulos/finanzas.js']) {
  const src = readFileSync(new URL(ruta, import.meta.url), 'utf8');
  new Function('defineAppMethods', 'html', 'raw', 'accion', 'ModulosCore', 'document', 'navigator', 'module', src)(
    m => Object.assign(methods, m), html, raw, accion, ModulosCore, document, {}, undefined);
}

function fakeApp(encendidos = ['habitos', 'personas', 'finanzas']) {
  els = {};
  marcados = [];
  return Object.assign(Object.create(methods), {
    state: { settings: { modulos: Object.fromEntries(encendidos.map(id => [id, true])) } },
    currentView: 'mod-habitos', toasts: [], saved: 0, renders: 0, navegado: [], capturas: [],
    saveState() { this.saved++; },
    showToast(m, cb, label) { this.toasts.push({ m, cb, label }); },
    render() { this.renders++; },
    navigate(v) { this.navegado.push(v); },
    captureThought(t, o) { this.capturas.push([t, o]); return []; }
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

test('los tres módulos se registran apagados y con ficha propia', () => {
  assert.deepEqual(ModulosCore.lista().map(m => [m.id, m.coleccion, m.activoPorDefecto]), [['habitos', 'habits', false], ['personas', 'people', false], ['finanzas', 'expenses', false]]);
  const app = fakeApp([]);
  assert.deepEqual(app.fichasDeModulos(), []);
  const ajustes = app.renderModulosAjustes();
  assert.equal(comprobarAcciones(app, ajustes), 3);
  assert.ok(!ajustes.includes(' checked'));
  app.setModuloActivo('habitos', true);
  assert.deepEqual(app.fichasDeModulos(), [{ view: 'mod-habitos', icon: '🌱', label: 'Hábitos' }]);
  assert.match(app.renderModulosAjustes(), / checked/);
  assert.equal(app.tituloModulo('mod-habitos'), '🌱 Hábitos');
  assert.equal(app.tituloModulo('hacer'), '');

  // Una vista de módulo apagado ofrece encenderlo; apagar el que se está viendo lleva a Ajustes
  const panel = new El();
  app.currentView = 'mod-finanzas';
  assert.equal(app.renderVistaModulo(panel), true);
  assert.match(panel.innerHTML, /Encender este módulo/);
  app.currentView = 'hacer';
  assert.equal(app.renderVistaModulo(panel), false);
  app.currentView = 'mod-habitos';
  app.setModuloActivo('habitos', false);
  assert.deepEqual(app.navegado, ['mas']);
});

test('hábitos en la app: añadir, marcar con deshacer, candidato en Ahora y borrar', () => {
  const app = fakeApp();
  els['habito-nombre'] = new El('Agua <b>');
  els['habito-emoji'] = new El('💧');
  marcados = [];
  app.crearHabito({ preventDefault() {} });
  const [h] = app.modVivos('habits');
  assert.equal(h.name, 'Agua <b>');

  const panel = new El();
  app.renderViewHabitos(panel);
  assert.match(panel.innerHTML, /💧 Agua &lt;b&gt;/);
  assert.ok(!panel.innerHTML.includes('Agua <b>'));
  assert.ok(comprobarAcciones(app, panel.innerHTML) >= 3);

  assert.match(app.renderCandidatoModulos(), /También hoy:<\/span> 💧 Agua &lt;b&gt;/);
  assert.deepEqual(app.resumenDeModulos(), ['🌱 Hábitos de hoy: Agua <b>']);
  app.marcarHabito(h.id, true);
  assert.equal(HabitosCore.hecho(app.modVivos('habits')[0], HabitosCore.claveDia(Date.now())), true);
  assert.equal(app.renderCandidatoModulos(), '', 'hecho hoy: deja de sugerirse');
  assert.equal(app.toasts.at(-1).label, 'Deshacer');
  app.toasts.at(-1).cb();
  assert.equal(HabitosCore.hecho(app.modVivos('habits')[0], HabitosCore.claveDia(Date.now())), false);

  app.borrarHabito(h.id);
  assert.equal(app.modVivos('habits').length, 0);
  assert.equal(app.state.modulos.habits[0].deleted, true, 'queda la marca de borrado');
  app.toasts.at(-1).cb();
  assert.equal(app.modVivos('habits').length, 1);
});

test('personas en la app: sugerencia en Ahora y «hablamos hoy»', () => {
  const app = fakeApp(['personas']);
  els['persona-nombre'] = new El('Ana');
  els['persona-cada'] = new El('7');
  els['persona-cumple'] = new El('');
  els['persona-nota'] = new El('Le gusta el <té>');
  app.crearPersona({ preventDefault() {} });
  const [ana] = app.modVivos('people');
  // Se añadió hace 20 días y aún no hay contacto apuntado
  app.state.modulos.people[0] = { ...ana, createdAt: new Date(Date.now() - 20 * DIA).toISOString() };
  assert.match(app.renderCandidatoModulos(), /Hace 20 días que no hablas con Ana/);
  const panel = new El();
  app.currentView = 'mod-personas';
  assert.equal(app.renderVistaModulo(panel), true);
  assert.match(panel.innerHTML, /Le gusta el &lt;té&gt;/);
  assert.ok(comprobarAcciones(app, panel.innerHTML) >= 3);
  app.registrarContactoPersona(ana.id);
  assert.equal(app.renderCandidatoModulos(), '');
  app.borrarPersona(ana.id);
  assert.equal(app.modVivos('people').length, 0);
});

test('finanzas en la app: apuntar, pregunta suave en gastos altos y captura desde Soltar', () => {
  const app = fakeApp(['finanzas']);
  app.currentView = 'mod-finanzas';
  els['gasto-texto'] = new El('café 65');
  app.apuntarGastoRapido({ preventDefault() {} });
  assert.equal(app.modVivos('expenses').length, 1);
  assert.equal(app.toasts.at(-1).label, 'Deshacer');
  els['gasto-texto'] = new El('algo sin número');
  app.apuntarGastoRapido({ preventDefault() {} });
  assert.match(app.toasts.at(-1).m, /No veo el importe/);
  assert.equal(app.modVivos('expenses').length, 1);

  app.apuntarGasto({ amount: 900, note: 'audífonos' });
  assert.match(app.toasts.at(-1).m, /¿Dopamina rápida o necesidad\?/);
  app.toasts.at(-1).cb();
  assert.equal(app.modVivos('expenses').find(g => g.note === 'audífonos').impulse, true);

  const panel = new El();
  app.renderViewFinanzas(panel);
  assert.match(panel.innerHTML, /\$965/);
  assert.ok(!/rose-|red-/.test(panel.innerHTML.replace(/hover:text-rose-400/g, '')), 'sin números rojos');
  assert.ok(comprobarAcciones(app, panel.innerHTML) >= 5);

  // Desde Soltar: solo con verbo, y se puede devolver a pensamiento
  assert.equal(app.capturarGasto('café 65'), false);
  assert.equal(app.capturarGasto('gasté 40 en pan', { category: 'humo_rojo' }), false, 'si eligió categoría, es un pensamiento');
  assert.equal(app.capturarGasto('gasté 40 en pan'), true);
  assert.equal(app.modVivos('expenses').length, 3);
  app.toasts.at(-1).cb();
  assert.equal(app.modVivos('expenses').length, 2);
  assert.deepEqual(app.capturas[0], ['gasté 40 en pan', { noModulos: true, skipSplit: true }]);
  assert.equal(fakeApp([]).capturarGasto('gasté 40 en pan'), false, 'módulo apagado: no se queda nada');
});
