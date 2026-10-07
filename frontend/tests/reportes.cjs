const assert = require('node:assert/strict');
const { resumirReporte } = require('../src/DetalleMascota.tsx');
assert.equal(resumirReporte('Breve'), 'Breve');
assert.equal(resumirReporte('x'.repeat(100)), 'x'.repeat(100));
assert.equal(resumirReporte('x'.repeat(101)), 'x'.repeat(100)+'…');
assert.equal(resumirReporte('🐶'.repeat(101)), '🐶'.repeat(100)+'…');
console.log('OK: reportes breves, límite de 100 caracteres y caracteres Unicode.');
