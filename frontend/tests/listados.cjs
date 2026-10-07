// Desde la raíz: node --require ./backend/node_modules/tsx/dist/cjs/index.cjs frontend/tests/listados.cjs
const assert = require('node:assert/strict');
const { consultar } = require('../src/ListadoVeterinarios.tsx');
const { consultarListado } = require('../src/api.ts');
(async () => {
  const originalFetch = global.fetch;
  try {
    // Incluye el punto de llamada real de Veterinarios y el lector compartido
    // disponible para los futuros listados de dueños y gestores.
    for (const leer of [consultar, ...['duenos', 'gestores'].map(tipo => () => consultarListado(`/api/admin/${tipo}`))]) {
      for (const status of [200, 404, 502]) {
        global.fetch = async () => new Response('<!DOCTYPE html><html></html>', { status, headers: { 'Content-Type': 'text/html' } });
        await assert.rejects(leer(), { message: 'No se pudo cargar el listado. El servidor devolvió una respuesta inválida.' });
      }
      global.fetch = async () => new Response('[]', { headers: { 'Content-Type': 'application/json' } });
      assert.deepEqual(await leer(), []);
      global.fetch = async () => new Response(null, { status: 204 });
      assert.deepEqual(await leer(), []);
      global.fetch = async () => new Response('{"unexpected":true}');
      await assert.rejects(leer(), { message: 'No se pudo cargar el listado. El servidor devolvió una respuesta inválida.' });
      global.fetch = async () => new Response('[{"id":1,"nombre":"Ana"}]');
      assert.deepEqual(await leer(), [{ id: 1, nombre: 'Ana' }]);
      global.fetch = async () => new Response('{"error":"Acceso denegado"}', { status: 403 });
      await assert.rejects(leer(), { message: 'Acceso denegado' });
      global.fetch = async () => { throw new Error('Sin conexión'); };
      await assert.rejects(leer(), { message: 'Sin conexión' });
    }
    global.fetch = async () => new Response('<!DOCTYPE html>');
    await assert.rejects(consultar('/1'), { message: 'No se pudo leer la respuesta del servidor. Intentá nuevamente.' });
    console.log('OK: HTML, listas vacías, respuestas inválidas, listas con datos y errores de acceso/conexión.');
  } finally { global.fetch = originalFetch; }
})().catch(error => { console.error(error); process.exitCode = 1; });
