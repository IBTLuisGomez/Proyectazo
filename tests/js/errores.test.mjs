// Registro de errores del navegador: qué se envía y qué se descarta.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const NexusErrores = createRequire(import.meta.url)('../../js/errores.js');
const entorno = { origen: 'https://nexus.ejemplo.com', vista: 'notas', userAgent: 'UA' };

test('prepara el error con rutas relativas y sin campos de más', () => {
  NexusErrores.reiniciar();
  const p = NexusErrores.preparar('error', 'x is not defined', {
    source: 'https://nexus.ejemplo.com/js/app.js', line: 12, column: 3,
    stack: 'ReferenceError: x\n at https://nexus.ejemplo.com/js/app.js:12:3', contenido: 'texto privado'
  }, entorno);
  assert.deepEqual(Object.keys(p).sort(), ['column', 'kind', 'line', 'message', 'source', 'stack', 'userAgent', 'view']);
  assert.equal(p.source, '/js/app.js');
  assert.ok(!p.stack.includes('nexus.ejemplo.com'));
  assert.equal(p.view, 'notas');
});

test('descarta vacíos, errores de otro origen y repetidos', () => {
  NexusErrores.reiniciar();
  assert.equal(NexusErrores.preparar('error', '', {}, entorno), null);
  assert.equal(NexusErrores.preparar('error', 'Script error.', {}, entorno), null);
  assert.ok(NexusErrores.preparar('error', 'fallo', { source: '/js/a.js', line: 1 }, entorno));
  assert.equal(NexusErrores.preparar('error', 'fallo', { source: '/js/a.js', line: 1 }, entorno), null);
  assert.ok(NexusErrores.preparar('error', 'fallo', { source: '/js/a.js', line: 2 }, entorno), 'otra línea es otro error');
});

test('un error en bucle no pasa del límite por visita', () => {
  NexusErrores.reiniciar();
  let enviados = 0;
  for (let i = 0; i < 50; i++) if (NexusErrores.preparar('error', `fallo ${i}`, {}, entorno)) enviados++;
  assert.equal(enviados, NexusErrores.MAX_POR_VISITA);
});

test('recorta textos largos', () => {
  NexusErrores.reiniciar();
  const p = NexusErrores.preparar('promesa', 'm'.repeat(2000), { stack: 's'.repeat(9000) }, entorno);
  assert.equal(p.message.length, 500);
  assert.equal(p.stack.length, 3000);
});
