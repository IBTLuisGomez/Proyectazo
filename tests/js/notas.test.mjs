// Listas y notas (tipo Keep): modelo y mezcla entre dispositivos. Ejecutar: node --test tests/js/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const NotasCore = require('../../js/notas-core.js');

const T1 = '2026-01-01T10:00:00.000Z';
const T2 = '2026-01-01T11:00:00.000Z';
const T3 = '2026-01-01T12:00:00.000Z';

function lista(extra = {}) {
  return {
    id: 'n1', kind: 'lista', title: 'Compras', text: '', color: 'ninguno', pinned: false, archived: false, deleted: false,
    items: [{ id: 'a', text: 'Pan', done: false, updatedAt: T1 }, { id: 'b', text: 'Leche', done: false, updatedAt: T1 }],
    createdAt: T1, updatedAt: T1, metaAt: T1, ...extra
  };
}

test('crear: lista con elementos y fechas', () => {
  const n = NotasCore.crear({ title: 'Súper', items: ['Pan', '  ', 'Leche'] }, T1);
  assert.equal(n.kind, 'lista');
  assert.deepEqual(n.items.map(i => i.text), ['Pan', 'Leche']);
  assert.equal(n.metaAt, T1);
  assert.notEqual(n.items[0].id, n.items[1].id);
});

test('mezclar: cambios en elementos distintos desde dos dispositivos se conservan los dos', () => {
  const web = lista({ updatedAt: T2 });
  web.items[0] = { id: 'a', text: 'Pan integral', done: false, updatedAt: T2 };
  const widget = lista({ updatedAt: T3 });
  widget.items[1] = { id: 'b', text: 'Leche', done: true, updatedAt: T3 };
  const out = NotasCore.mezclar(web, widget);
  assert.equal(out.items.find(i => i.id === 'a').text, 'Pan integral');
  assert.equal(out.items.find(i => i.id === 'b').done, true);
  assert.equal(out.updatedAt, T3);
});

test('mezclar: marcar en el widget no pisa un título más nuevo', () => {
  const web = lista({ title: 'Compras del sábado', metaAt: T2, updatedAt: T2 });
  const widget = lista({ updatedAt: T3 }); // metaAt sigue en T1
  widget.items[0] = { id: 'a', text: 'Pan', done: true, updatedAt: T3 };
  for (const out of [NotasCore.mezclar(web, widget), NotasCore.mezclar(widget, web)]) {
    assert.equal(out.title, 'Compras del sábado');
    assert.equal(out.items[0].done, true);
  }
});

test('mezclar: un elemento nuevo del otro lado se añade y el orden lo pone quien gana', () => {
  const local = lista({ metaAt: T2, updatedAt: T2 });
  local.items.reverse();
  const remota = lista();
  remota.items.push({ id: 'c', text: 'Huevos', done: false, updatedAt: T1 });
  assert.deepEqual(NotasCore.mezclar(local, remota).items.map(i => i.id), ['b', 'a', 'c']);
});

test('mezclar: lo borrado no resucita, y deshacer el borrado sí lo devuelve', () => {
  const borrada = { id: 'n1', deleted: true, title: '', items: [], createdAt: T1, updatedAt: T2, metaAt: T2 };
  const vieja = lista();
  const out = NotasCore.mezclar(vieja, borrada);
  assert.equal(out.deleted, true);
  assert.deepEqual(out.items, []);
  const restaurada = lista({ updatedAt: T3, metaAt: T3 });
  const vuelta = NotasCore.mezclar(borrada, restaurada);
  assert.equal(vuelta.deleted, false);
  assert.equal(vuelta.items.length, 2);
});

test('mezclar: un elemento quitado no vuelve con una copia más vieja', () => {
  const local = lista({ updatedAt: T2 });
  local.items[0] = { id: 'a', text: 'Pan', done: false, updatedAt: T2, deleted: true };
  const out = NotasCore.mezclar(local, lista());
  assert.deepEqual(NotasCore.itemsVivos(out).map(i => i.id), ['b']);
});

test('mezclarListas: añade las nuevas, mezcla las comunes y conserva las solo locales', () => {
  const soloLocal = lista({ id: 'n2', title: 'Local' });
  const out = NotasCore.mezclarListas([lista(), soloLocal], [lista({ title: 'Otra', metaAt: T2, updatedAt: T2 }), lista({ id: 'n3' })]);
  assert.deepEqual(out.map(n => n.id), ['n1', 'n2', 'n3']);
  assert.equal(out[0].title, 'Otra');
});

test('visibles: sin borradas ni archivadas, fijadas primero y búsqueda en elementos', () => {
  const notas = [
    lista({ id: 'x', title: 'Vieja', createdAt: T1 }),
    lista({ id: 'y', title: 'Nueva', createdAt: T3 }),
    lista({ id: 'z', title: 'Fijada', pinned: true, createdAt: T2 }),
    lista({ id: 'w', archived: true }),
    lista({ id: 'v', deleted: true })
  ];
  assert.deepEqual(NotasCore.visibles(notas).map(n => n.id), ['z', 'y', 'x']);
  assert.deepEqual(NotasCore.visibles(notas, { archivo: true }).map(n => n.id), ['w']);
  assert.equal(NotasCore.visibles(notas, { busqueda: 'LECHE' }).length, 3);
  assert.equal(NotasCore.visibles(notas, { busqueda: 'nada de esto' }).length, 0);
});

test('aLista y aTexto: cada línea es un elemento y al revés', () => {
  const n = NotasCore.crear({ kind: 'nota', text: 'Pan\n\nLeche' }, T1);
  NotasCore.aLista(n, T2);
  assert.equal(n.kind, 'lista');
  assert.deepEqual(NotasCore.itemsVivos(n).map(i => i.text), ['Pan', 'Leche']);
  NotasCore.aTexto(n, T3);
  assert.equal(n.text, 'Pan\nLeche');
  assert.equal(NotasCore.itemsVivos(n).length, 0);
});

test('estaVacia', () => {
  assert.equal(NotasCore.estaVacia(NotasCore.crear()), true);
  assert.equal(NotasCore.estaVacia(NotasCore.crear({ items: ['x'] })), false);
});

test('aplicarOperacion: los cambios del widget se aplican una sola vez', () => {
  const notas = [lista()];
  const add = { opId: 'o1', type: 'add', notaId: 'n1', itemId: 'c', text: ' Huevos ', at: T2 };
  assert.equal(NotasCore.aplicarOperacion(notas, add), true);
  assert.equal(NotasCore.aplicarOperacion(notas, add), false);
  assert.deepEqual(notas[0].items.map(i => i.text), ['Pan', 'Leche', 'Huevos']);

  assert.equal(NotasCore.aplicarOperacion(notas, { type: 'done', notaId: 'n1', itemId: 'a', done: true, at: T2 }), true);
  assert.equal(notas[0].items[0].done, true);
  assert.ok(NotasCore.tiempo(notas[0].updatedAt) > NotasCore.tiempo(T2), 'la nota queda marcada para enviarse');

  // Un cambio del widget más viejo que lo que ya hay no pisa
  notas[0].items[0].updatedAt = T3;
  assert.equal(NotasCore.aplicarOperacion(notas, { type: 'done', notaId: 'n1', itemId: 'a', done: false, at: T2 }), false);
  assert.equal(notas[0].items[0].done, true);

  // Lista creada en el widget y operaciones sobre listas que ya no existen
  const nueva = lista({ id: 'n9', title: 'Pendientes' });
  assert.equal(NotasCore.aplicarOperacion(notas, { type: 'nota', nota: nueva }), true);
  assert.equal(NotasCore.aplicarOperacion(notas, { type: 'nota', nota: nueva }), false);
  assert.equal(NotasCore.aplicarOperacion(notas, { type: 'add', notaId: 'no-existe', itemId: 'q', text: 'x' }), false);
});
