// Desde la raíz: node --require ./backend/node_modules/tsx/dist/cjs/index.cjs frontend/tests/duenos.cjs
const assert = require('node:assert/strict');
const { filtrarDuenos } = require('../src/ListadoDuenos.tsx');
const duenos = [
  { id: 1, nombre: 'Ana', dni: '01234567', email: 'ana@example.test' },
  { id: 2, nombre: null, dni: '88888888', email: 'otro@example.test' },
];
assert.deepEqual(filtrarDuenos(duenos, ''), duenos);
assert.deepEqual(filtrarDuenos(duenos, '01234567'), [duenos[0]]);
assert.deepEqual(filtrarDuenos(duenos, ' 0123 '), [duenos[0]]);
assert.deepEqual(filtrarDuenos(duenos, '888'), [duenos[1]]);
assert.deepEqual(filtrarDuenos(duenos, '999'), []);
assert.deepEqual(filtrarDuenos(duenos, 'Ana'), []);
assert.deepEqual(filtrarDuenos([], '0123'), []);
console.log('OK: filtro por DNI completo/parcial, ceros iniciales, lista vacía y sin coincidencias.');
