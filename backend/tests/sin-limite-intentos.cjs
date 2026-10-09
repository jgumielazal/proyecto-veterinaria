// Ejecutar desde backend: node --require tsx/cjs tests/sin-limite-intentos.cjs
const assert = require('node:assert/strict');
const express = require('express');
const configurarAuth = require('../src/auth.ts');
const app = express(); app.use(express.json());
configurarAuth(app, { query() { throw new Error('Los datos inválidos no deben consultar la base'); } });
const server = app.listen(0, '127.0.0.1', async () => {
  try {
    for (let i=0; i<25; i++) {
      const r = await fetch(`http://127.0.0.1:${server.address().port}/auth/login`, {
        method:'POST', headers:{'Content-Type':'application/json','X-Requested-With':'veterinaria'},body:'{}'
      });
      assert.equal(r.status,400,`Intento ${i+1}: debe validar datos sin bloquear`);
    }
    console.log('OK: 25 intentos seguidos sin bloqueo ni espera.');
  } catch(e) {console.error(e.message);process.exitCode=1;} finally {server.close();}
});
