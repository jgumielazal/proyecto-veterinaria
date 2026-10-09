// Desde backend: node --require tsx/cjs tests/activacion.cjs
// El esquema y los datos de prueba son temporales; no modifica cuentas reales.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const pool = require('../src/db/pool.ts');
(async () => {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query('CREATE TEMP TABLE usuarios(id INT PRIMARY KEY, password_hash TEXT NOT NULL) ON COMMIT DROP');
    await db.query('SET LOCAL search_path TO pg_temp');
    await db.query("INSERT INTO usuarios VALUES (1,'hash-de-prueba')");
    await db.query(fs.readFileSync(path.join(__dirname,'../migrations/011_activacion_usuarios.sql'),'utf8'));
    assert.deepEqual((await db.query('SELECT * FROM usuarios WHERE id=1')).rows[0],{id:1,password_hash:'hash-de-prueba',estado_activacion:'activada'});
    await db.query("INSERT INTO usuarios(id,password_hash,estado_activacion) VALUES (2,NULL,'pendiente')");
    for (const [estado,hash,code] of [['otro',null,'23514'],['activada',null,'23514'],['activada',' ','23514'],['pendiente','hash','23514'],[null,null,'23502']]) {
      await db.query('SAVEPOINT invalid');
      await assert.rejects(db.query('INSERT INTO usuarios VALUES (3,$1,$2)',[hash,estado]),{code});
      await db.query('ROLLBACK TO SAVEPOINT invalid');
    }
    await db.query("UPDATE usuarios SET password_hash='nuevo-hash',estado_activacion='activada' WHERE id=2");
    assert.equal((await db.query('SELECT estado_activacion FROM usuarios WHERE id=2')).rows[0].estado_activacion,'activada');
    console.log('OK: preservación de cuentas, estado pendiente sin contraseña y restricciones de activación.');
  } finally { await db.query('ROLLBACK'); db.release(); await pool.end(); }
})().catch(error=>{console.error(error);process.exitCode=1});
