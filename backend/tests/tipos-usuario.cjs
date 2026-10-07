// Ejecutar desde backend: node --require tsx/cjs tests/tipos-usuario.cjs
// Usa tablas temporales y revierte la transacción; no modifica cuentas reales.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const crearDao = require('../src/dao/auth.dao.ts');
const { crearAuthNegocio } = require('../src/negocio/auth.negocio.ts');
const db = new Client(process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL }
  : { host: '127.0.0.1', user: 'veterinaria', password: 'veterinaria_local', database: 'veterinaria' });
(async () => {
  await db.connect();
  await db.query('BEGIN');
  await db.query('CREATE TEMP TABLE usuarios (id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL) ON COMMIT DROP');
  await db.query("INSERT INTO usuarios (email, password_hash) VALUES ('existente@example.test', 'hash')");
  await db.query('CREATE TEMP TABLE sesiones (token_hash TEXT PRIMARY KEY, usuario_id INTEGER NOT NULL, expira TIMESTAMPTZ NOT NULL) ON COMMIT DROP');
  await db.query('SET LOCAL search_path TO pg_temp');
  await db.query(fs.readFileSync(path.join(__dirname, '../migrations/004_tipos_usuario.sql'), 'utf8'));
  await db.query(fs.readFileSync(path.join(__dirname, '../migrations/007_estado_usuarios.sql'), 'utf8'));
  assert.equal((await db.query('SELECT activo FROM usuarios')).rows[0].activo, true);
  assert.equal((await db.query('SELECT tipo FROM usuarios')).rows[0].tipo, 'cliente');
  const dao = crearDao(db);
  const negocio = crearAuthNegocio(dao);
  const password = 'Prueba-segura-123';
  for (const tipo of ['cliente', 'veterinario', 'admin']) {
    const email = tipo + '@example.test';
    const registro = await negocio.acceder('registro', { email, password, tipo, rol: tipo, role: tipo });
    const usuario = registro.usuario;
    assert.deepEqual(Object.keys(usuario).sort(), ['email', 'id', 'tipo']);
    assert.equal((await db.query('SELECT tipo FROM usuarios WHERE id=$1', [usuario.id])).rows[0].tipo, 'cliente');
    await db.query('UPDATE usuarios SET tipo=$1 WHERE id=$2', [tipo, usuario.id]);
    assert.deepEqual((await negocio.acceder('login', { email, password })).usuario, { ...usuario, tipo });
    assert.deepEqual(await negocio.autenticar(registro.token), { ...usuario, tipo });
    const interno = await dao.crearUsuario('interno-' + email, 'hash', tipo);
    assert.equal((await db.query('SELECT tipo FROM usuarios WHERE id=$1', [interno.id])).rows[0].tipo, tipo);
  }
  for (const tipo of ['desconocido', null]) {
    await db.query('SAVEPOINT invalido');
    await assert.rejects(db.query('UPDATE usuarios SET tipo=$1', [tipo]), { code: tipo === null ? '23502' : '23514' });
    await db.query('ROLLBACK TO SAVEPOINT invalido');
  }
  console.log('OK: migración, cuentas existentes, tres tipos, registro público, login, sesión y restricciones.');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  await db.query('ROLLBACK').catch(() => {});
  await db.end();
});
