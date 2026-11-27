// Micro-pasos de tareas (js/pasos-core.js). Ejecutar: node --test tests/js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const P = require('../../js/pasos-core.js');

test('normalizar quita vacíos, recorta y acepta textos sueltos', () => {
  const out = P.normalizar(['  Abrir IDE  ', '', null, { text: 'Escribir test', done: true, doneAt: 'x' }, { text: '   ' }]);
  assert.equal(out.length, 2);
  assert.equal(out[0].text, 'Abrir IDE');
  assert.equal(out[0].done, false);
  assert.equal(out[1].done, true);
  assert.ok(out[0].id && out[1].id && out[0].id !== out[1].id);
});

test('normalizar respeta el tope de pasos y no repite ids', () => {
  const muchos = Array.from({ length: 30 }, (_, i) => ({ id: 'a', text: `p${i}` }));
  const out = P.normalizar(muchos);
  assert.equal(out.length, P.MAX_PASOS);
  assert.equal(new Set(out.map(s => s.id)).size, out.length);
});

test('progreso y siguiente', () => {
  const steps = P.normalizar([{ id: '1', text: 'a', done: true }, { id: '2', text: 'b' }, { id: '3', text: 'c' }]);
  assert.deepEqual(P.progreso(steps), { hechos: 1, total: 3, pct: 33, completo: false });
  assert.equal(P.siguiente(steps).id, '2');
  assert.deepEqual(P.progreso([]), { hechos: 0, total: 0, pct: 0, completo: false });
  assert.equal(P.siguiente([]), null);
});

test('alternar no muta y marca la fecha al hacer', () => {
  const steps = P.normalizar([{ id: '1', text: 'a' }]);
  const hecho = P.alternar(steps, '1', '2026-11-25T10:00:00Z');
  assert.equal(steps[0].done, false);
  assert.equal(hecho[0].done, true);
  assert.equal(hecho[0].doneAt, '2026-11-25T10:00:00Z');
  const deshecho = P.alternar(hecho, '1');
  assert.equal(deshecho[0].done, false);
  assert.ok(!('doneAt' in deshecho[0]));
  assert.ok(P.progreso(hecho).completo);
});

test('desdeSugerencia pone primero el arranque y quita la numeración de la IA', () => {
  const out = P.desdeSugerencia({ kickstart_action: 'Abrir el repo', atomic_steps: ['1. Crear DTO', '2) Endpoint GET'] });
  assert.deepEqual(out.map(s => s.text), ['Abrir el repo', 'Crear DTO', 'Endpoint GET']);
  assert.deepEqual(P.desdeSugerencia(null), []);
});

test('plantilla da 3 pasos con el título', () => {
  const out = P.plantilla('Declaración anual');
  assert.equal(out.length, 3);
  assert.match(out[0].text, /Declaración anual/);
});
