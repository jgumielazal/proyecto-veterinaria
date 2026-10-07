// Tablas temporales: no modifica usuarios reales.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const pool = require('../src/db/pool.ts');
(async () => {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query('CREATE TEMP TABLE usuarios (id INTEGER PRIMARY KEY) ON COMMIT DROP');
    await db.query('SET LOCAL search_path TO pg_temp');
    await db.query('INSERT INTO usuarios(id) VALUES (46),(7),(40),(21),(8)');
    const sql = fs.readFileSync(require('node:path').join(__dirname,'../migrations/008_dni_usuarios.sql'),'utf8');
    await db.query(sql);
    assert.deepEqual((await db.query('SELECT dni FROM usuarios ORDER BY id')).rows.map(r=>r.dni),['11111111','22222222','33333333','44444444','55555555']);
    for (const [dni, code] of [[null,'23502'],['11111111','23505'],['1234567','23514'],['123456789','23514'],['12A45678','23514'],['1234567\n','23514'],['12345678 ','23514']]) {
      await db.query('SAVEPOINT invalid');
      await assert.rejects(db.query('INSERT INTO usuarios(id,dni) VALUES (99,$1)',[dni]),{code});
      await db.query('ROLLBACK TO SAVEPOINT invalid');
    }
    await db.query("INSERT INTO usuarios(id,dni) VALUES (99,'01234567')");
    assert.equal((await db.query("SELECT id FROM usuarios WHERE dni='01234567'")).rows[0].id,99);
    assert.ok((await db.query("SELECT 1 FROM pg_indexes WHERE tablename='usuarios' AND indexname='usuarios_dni_key'")).rowCount);
    console.log('OK: asignación por id, ocho dígitos, obligatorio, unicidad, ceros iniciales y búsqueda indexada.');
  } finally { await db.query('ROLLBACK'); db.release(); await pool.end(); }
})().catch(e=>{console.error(e);process.exitCode=1});
