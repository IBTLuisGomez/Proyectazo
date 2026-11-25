// Foco acompañado, estimaciones aprendidas, cierre del día y revisión semanal (Fases 11-14).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const FocoCore = createRequire(import.meta.url)('../../js/foco-core.js');
const MIN = 60000;

// Simula el temporizador en marcha: un tick por segundo durante `minutos`
function correr(estado, desdeMs, minutos, config) {
  const avisos = [];
  let t = desdeMs;
  for (let i = 0; i < minutos * 60; i++) {
    t += 1000;
    const r = FocoCore.tick(estado, t, config);
    estado = r.estado;
    if (r.aviso) avisos.push([r.aviso, Math.round((t - desdeMs) / MIN)]);
  }
  return { estado, avisos, fin: t };
}

test('check-in cada N minutos de foco y nada si está apagado', () => {
  const con = correr(FocoCore.nuevoEstado(), 1e9, 50, { checkInMin: 15 });
  assert.deepEqual(con.avisos, [['checkin', 15], ['checkin', 30], ['checkin', 45]]);
  assert.deepEqual(correr(FocoCore.nuevoEstado(), 1e9, 50, { checkInMin: 0 }).avisos, []);
  assert.deepEqual(correr(FocoCore.nuevoEstado(), 1e9, 50, {}).avisos, []);
});

test('aviso de hiperfoco una sola vez a los 90 minutos seguidos', () => {
  const r = correr(FocoCore.nuevoEstado(), 1e9, 200, {});
  assert.deepEqual(r.avisos, [['hiperfoco', 90]]);
});

test('una pausa corta no reinicia la cuenta; un descanso de verdad sí', () => {
  let r = correr(FocoCore.nuevoEstado(), 1e9, 60, {});
  // Pausa de 3 minutos: no cuenta como foco, pero la racha sigue
  r = correr(r.estado, r.fin + 3 * MIN, 35, {});
  assert.deepEqual(r.avisos.map(a => a[0]), ['hiperfoco']);
  // Descanso de 10 minutos: empieza de cero y puede volver a avisar 90 minutos después
  const tras = correr(r.estado, r.fin + 10 * MIN, 89, {});
  assert.deepEqual(tras.avisos, []);
  assert.deepEqual(correr(tras.estado, tras.fin, 2, {}).avisos.map(a => a[0]), ['hiperfoco']);
});

test('el tiempo en pausa no se cuenta como foco, y una pestaña en segundo plano sí', () => {
  let e = FocoCore.tick(FocoCore.nuevoEstado(), 1000, {}).estado;
  assert.equal(FocoCore.tick(e, 1000 + 4 * MIN, {}).delta, 0, 'hueco de 4 min = pausa');
  assert.equal(FocoCore.tick(e, 1000 + 60000, {}).delta, 60000, 'tick cada minuto en segundo plano');
  assert.equal(FocoCore.tick(FocoCore.nuevoEstado(), 5000, {}).delta, 0, 'el primer tick no suma');
});

test('factor de estimación: mediana de lo real frente a lo estimado, con mínimo de muestras', () => {
  const m = (effort, estimado, real) => ({ effort, estimado, real });
  assert.equal(FocoCore.factor([m('S', 15, 30), m('S', 15, 30)], 'S'), null, 'pocas muestras');
  assert.equal(FocoCore.factor([m('S', 15, 30), m('S', 15, 24), m('S', 15, 21)], 'S'), 1.6);
  // Una tarde desastrosa no mueve la mediana, y otros tamaños no cuentan
  assert.equal(FocoCore.factor([m('S', 15, 15), m('S', 15, 16), m('S', 15, 300), m('M', 45, 200)], 'S'), 1.1);
  assert.equal(FocoCore.factor([m('S', 15, 900), m('S', 15, 900), m('S', 15, 900)], 'S'), 3, 'tope');
  assert.equal(FocoCore.factor([m('S', 15, 1), m('S', 15, 1), m('S', 15, 1)], 'S'), 0.5, 'suelo');
  assert.equal(FocoCore.factor([m('S', 0, 5), m('S', 15, 0), m('S', 15, 15)], 'S'), null, 'muestras no válidas');
});

test('estimación ajustada en múltiplos de 5 y solo si cambia', () => {
  assert.equal(FocoCore.ajustada(15, 1.6), 25);
  assert.equal(FocoCore.ajustada(45, 1.1), 50);
  assert.equal(FocoCore.ajustada(15, 1), null);
  assert.equal(FocoCore.ajustada(5, 0.5), null, 'el mínimo es 5 y no cambia');
  assert.equal(FocoCore.ajustada(15, null), null);
});

test('semana: empieza el lunes a las 00:00 (hora local)', () => {
  const jueves = new Date(2026, 10, 26, 15, 30).getTime();
  const lunes = new Date(FocoCore.inicioSemana(jueves));
  assert.equal(lunes.getDay(), 1);
  assert.equal(FocoCore.claveSemana(jueves), '2026-11-23');
  const domingo = new Date(2026, 10, 29, 23, 0).getTime();
  assert.equal(FocoCore.claveSemana(domingo), '2026-11-23', 'el domingo pertenece a la semana que acaba');
  assert.equal(FocoCore.claveSemana(new Date(2026, 10, 30, 0, 5).getTime()), '2026-11-30');
});

test('primeroDeHoy: lo dicho en el último cierre, si es reciente', () => {
  const hoy = new Date(2026, 10, 26, 9, 0).getTime();
  const cierres = [
    { date: '2026-11-24', manana: 'viejo' },
    { date: '2026-11-25', manana: '  Llamar al banco ' },
    { date: '2026-11-26', manana: 'esto es para mañana' }
  ];
  assert.equal(FocoCore.primeroDeHoy(cierres, hoy), 'Llamar al banco');
  assert.equal(FocoCore.primeroDeHoy([{ date: '2026-11-10', manana: 'antiguo' }], hoy), '');
  assert.equal(FocoCore.primeroDeHoy([{ date: '2026-11-25', manana: '  ' }], hoy), '');
  assert.equal(FocoCore.primeroDeHoy(undefined, hoy), '');
});

test('resumen de la semana: lo hecho, sin lo de semanas anteriores ni lo del Baúl', () => {
  const ahora = new Date(2026, 10, 26, 18, 0).getTime();
  const estaSemana = new Date(2026, 10, 24, 10, 0).toISOString();
  const pasada = new Date(2026, 10, 18, 10, 0).toISOString();
  const state = {
    projects: [
      { id: 'p1', name: 'Tesis', status: 'activo', lastActivity: estaSemana, tasks: [
        { title: 'Intro', column: 'victorias', updatedAt: estaSemana },
        { title: 'Vieja', column: 'victorias', updatedAt: pasada },
        { title: 'Pendiente', column: 'proximo', updatedAt: estaSemana }
      ] },
      { id: 'p2', name: 'Quieto', status: 'en_ejecucion', lastActivity: new Date(2026, 9, 1).toISOString(), tasks: [] },
      { id: 'p3', name: 'Esperando', status: 'activo', nextActionType: 'esperar', lastActivity: new Date(2026, 9, 1).toISOString() },
      { id: 'p4', name: 'Secreto', inBaul: true, status: 'activo', lastActivity: pasada, tasks: [{ title: 'X', column: 'victorias', updatedAt: estaSemana }] }
    ],
    focusSessions: [{ minutes: 25, at: estaSemana }, { minutes: 15, at: estaSemana }, { minutes: 99, at: pasada }],
    focusDistractions: [{ at: estaSemana }, { at: pasada }],
    notas: [
      { id: 'n1', items: [{ id: 'a', done: true, updatedAt: estaSemana }, { id: 'b', done: false, updatedAt: estaSemana }, { id: 'c', done: true, updatedAt: pasada }] },
      { id: 'n2', deleted: true, items: [{ id: 'd', done: true, updatedAt: estaSemana }] }
    ],
    pensadero: [{ category: 'humo_general' }, { category: 'humo_rojo' }, { isResolved: true }, { inBaul: true }, {}],
    cierres: [{ date: '2026-11-24' }, { date: '2026-11-10' }]
  };
  const r = FocoCore.resumenSemana(state, ahora);
  assert.equal(r.semana, '2026-11-23');
  assert.equal(r.minutosFoco, 40);
  assert.deepEqual(r.victorias, [{ title: 'Intro', project: 'Tesis' }]);
  assert.equal(r.tachados, 1);
  assert.equal(r.distracciones, 1);
  assert.equal(r.cierres, 1);
  assert.equal(r.sinClasificar, 2);
  assert.deepEqual(r.quietos.map(q => q.name), ['Quieto']);
  assert.ok(r.quietos[0].dias >= 50);
  // Estado vacío: no falla
  assert.equal(FocoCore.resumenSemana({}, ahora).minutosFoco, 0);
});
