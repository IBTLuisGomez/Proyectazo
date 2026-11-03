// Ejecutar: node --test tests/js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';

const require = createRequire(import.meta.url);
const P = require('../../js/captura-parser.js');
const casos = JSON.parse(readFileSync(new URL('../clasificacion_casos.json', import.meta.url), 'utf8')).casos;

test('clasifica cada frase de referencia como se espera', () => {
  for (const [frase, esperado] of casos) {
    assert.equal(P.classifyLocal(frase).category, esperado, frase);
  }
});

test('sin pistas queda sin clasificar y sin inventar categoría', () => {
  const r = P.classifyLocal('blablabla');
  assert.equal(r.category, 'humo_general');
  assert.equal(r.matched, false);
});

test('explica por qué clasificó', () => {
  const r = P.classifyLocal('Pagar la luz que vence mañana');
  assert.deepEqual(r.reasons.sort(), ['pagar', 'vence']);
  assert.ok(r.confidence > 0.5);
});

test('aprende de las correcciones del usuario', () => {
  assert.equal(P.classifyLocal('Bonsai del balcón').category, 'humo_general');
  const mem = P.learn({}, 'Regar el bonsai', 'humo_verde');
  const r = P.classifyLocal('Bonsai del balcón', { memory: mem });
  assert.equal(r.category, 'humo_verde');
  assert.ok(r.reasons.includes('bonsai'));
});

test('separa varias ideas sin partir frases normales', () => {
  assert.deepEqual(P.splitIdeas('- Comprar pan\n- Llamar a Ana\n\n3) Pagar luz'), ['Comprar pan', 'Llamar a Ana', 'Pagar luz']);
  assert.deepEqual(P.splitIdeas('Comprar pan; llamar a Ana'), ['Comprar pan', 'llamar a Ana']);
  assert.deepEqual(P.splitIdeas('Pan y leche'), ['Pan y leche']);
  assert.deepEqual(P.splitIdeas('Terminar informe y además preparar la reunión'), ['Terminar informe', 'preparar la reunión']);
});

test('limpia muletillas del dictado', () => {
  assert.equal(P.cleanDictation('eh   este comprar   pan ,'), 'Comprar pan,');
  assert.equal(P.cleanDictation('o sea llamar a eh Ana'), 'Llamar a Ana');
});

test('interpreta comandos, proyecto, importe, persona y fecha', () => {
  const now = new Date('2026-11-03T10:00:00');
  const a = P.parseIdea('urgente: pagar $1,250 del SAT', now);
  assert.equal(a.category, 'humo_rojo');
  assert.equal(a.amount, 1250);
  assert.equal(a.text, 'Pagar $1,250 del SAT');

  const b = P.parseIdea('para Clínica: revisar expedientes', now);
  assert.equal(b.projectName, 'Clínica');
  assert.equal(b.text, 'Revisar expedientes');

  assert.equal(P.parseIdea('llamar a Ana por el regalo', now).contactName, 'Ana');
  assert.equal(P.parseIdea('café con @Luis', now).contactName, 'Luis');

  assert.equal(P.parseIdea('mandar reporte en 2 horas', now).dueAt, now.getTime() + 2 * 3600000);
  const m = new Date(P.parseIdea('dentista mañana a las 5 pm', now).dueAt);
  assert.equal(m.getDate(), 4);
  assert.equal(m.getHours(), 17);
  assert.equal(P.parseIdea('sin fecha', now).dueAt, null);
});

test('la paleta no repite nombres, colores ni claves', () => {
  const src = readFileSync(new URL('../../js/smoke-palette.js', import.meta.url), 'utf8');
  const palette = new Function(src + '; return SMOKE_PALETTE;')();
  const entries = Object.entries(palette);
  const names = entries.map(([, m]) => m.name);
  const hexes = entries.map(([, m]) => m.hex);
  assert.equal(new Set(names).size, names.length, 'nombres repetidos: ' + names);
  assert.equal(new Set(hexes).size, hexes.length, 'colores repetidos: ' + hexes);
  for (const [key, m] of entries) assert.equal(m.category, key, `${key}.category`);
  // Cada categoría de las reglas existe en la paleta
  for (const c of require('../../js/clasificador-reglas.js').categories) assert.ok(palette[c.category], c.category);
});
