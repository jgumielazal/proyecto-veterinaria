// Desde backend: node --require tsx/cjs tests/primer-acceso.cjs
const assert = require('node:assert/strict');
const express = require('express');
const crypto = require('node:crypto');
const pool = require('../src/db/pool.ts');
const configurarAuth = require('../src/auth.ts');
const crearRouter = require('../src/routes/mascotas.routes.ts');
const { crearMascotasNegocio } = require('../src/negocio/mascotas.negocio.ts');
const crearDao = require('../src/dao/mascotas.dao.ts');
const app = express(); app.use(express.json()); configurarAuth(app,pool);
app.use('/mascotas',crearRouter(crearMascotasNegocio(crearDao(pool))));
const ids = []; const password = 'Primer-acceso-123'; const suffix = crypto.randomUUID();
let server;
(async()=>{
  server = app.listen(0,'127.0.0.1');
  await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
  const base = `http://127.0.0.1:${server.address().port}`;
  async function req(url,body,cookie='',method='POST') {
    return fetch(base+url,{method,headers:{'Content-Type':'application/json','X-Requested-With':'veterinaria',Cookie:cookie},...(body===undefined?{}:{body:JSON.stringify(body)})});
  }
  assert.equal((await req('/auth/registro',{email:`blocked-${suffix}@example.test`,dni:'90100003',password})).status,404);
  const admin = await require('./fixture-usuario.cjs')(pool,`admin-${suffix}@example.test`,password,'90100001','admin'); ids.push(admin.id);
  const login = await req('/auth/login',{email:admin.email,password}); assert.equal(login.status,200);
  const adminCookie = login.headers.get('set-cookie').split(';')[0];
  const created = await req('/admin/duenos',{nombre:'Cliente Prueba',dni:'90100002',email:`owner-${suffix}@example.test`,password,tipo:'admin'},adminCookie);
  assert.equal(created.status,201); assert.equal(created.headers.get('set-cookie'),null);
  const owner = await created.json(); ids.push(owner.id); assert.equal(owner.tipo,'cliente');
  assert.deepEqual((await pool.query('SELECT password_hash,estado_activacion FROM usuarios WHERE id=$1',[owner.id])).rows[0],{password_hash:null,estado_activacion:'pendiente'});
  for (const value of [undefined,'','corta',password]) {
    const pending = await req('/auth/login',{email:owner.email.toUpperCase(),password:value});
    assert.equal(pending.status,200); assert.equal(pending.headers.get('set-cookie'),null);
    assert.deepEqual(await pending.json(),{pendiente:true,email:owner.email});
  }
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM sesiones WHERE usuario_id=$1',[owner.id])).rows[0].n,0);
  for (const changes of [{repetirPassword:'otra'},{password:'corta',repetirPassword:'corta'},{repetirPassword:undefined}]) {
    assert.equal((await req('/auth/activar',{email:owner.email,password,repetirPassword:password,...changes})).status,400);
  }
  await pool.query('UPDATE usuarios SET activo=false WHERE id=$1',[owner.id]);
  assert.equal((await req('/auth/activar',{email:owner.email,password,repetirPassword:password})).status,401);
  await pool.query('UPDATE usuarios SET activo=true WHERE id=$1',[owner.id]);
  const attempts = await Promise.all([1,2].map(()=>req('/auth/activar',{email:owner.email,password,repetirPassword:password})));
  assert.deepEqual(attempts.map(r=>r.status).sort(),[200,401]);
  const success = attempts.find(r=>r.status===200); const cookie = success.headers.get('set-cookie').split(';')[0];
  assert.deepEqual(await success.json(),owner);
  assert.equal((await req('/auth/me',undefined,cookie,'GET')).status,200);
  const saved = (await pool.query('SELECT password_hash,estado_activacion FROM usuarios WHERE id=$1',[owner.id])).rows[0];
  assert.equal(saved.estado_activacion,'activada'); assert.notEqual(saved.password_hash,password); assert.ok(saved.password_hash);
  assert.equal((await req('/auth/login',{email:owner.email,password:'incorrecta'})).status,401);
  assert.equal((await req('/auth/login',{email:owner.email,password})).status,200);
  assert.equal((await req('/auth/activar',{email:owner.email,password:'Otra-clave-123',repetirPassword:'Otra-clave-123'})).status,401);
  assert.equal((await pool.query('SELECT password_hash FROM usuarios WHERE id=$1',[owner.id])).rows[0].password_hash,saved.password_hash);
  const pet = (await pool.query("INSERT INTO mascotas(nombre,especie,edad,usuario_id) VALUES ('Luna','gato',3,$1) RETURNING id,nombre,especie,edad",[owner.id])).rows[0];
  const other = (await pool.query("INSERT INTO mascotas(nombre,especie,edad,usuario_id) VALUES ('Ajena','perro',2,$1) RETURNING id",[admin.id])).rows[0];
  await pool.query("INSERT INTO mascotas(nombre,especie,edad,usuario_id,activa) VALUES ('Inactiva','gato',1,$1,false)",[owner.id]);
  await pool.query("INSERT INTO reportes_mascotas(mascota_id,texto,fecha) VALUES ($1,'Control clínico','2026-10-07')",[pet.id]);
  assert.deepEqual(await (await req('/dueno',undefined,cookie,'GET')).json(),{id:owner.id,nombre:'Cliente Prueba',dni:'90100002',email:owner.email,mascotas:[pet]});
  const detail = await req(`/dueno/mascotas/${pet.id}`,undefined,cookie,'GET'); assert.equal(detail.status,200);
  assert.equal((await detail.json()).reportes[0].texto,'Control clínico');
  assert.equal((await req(`/dueno/mascotas/${other.id}`,undefined,cookie,'GET')).status,404);
  assert.equal((await req('/dueno',undefined,adminCookie,'GET')).status,403);
  assert.equal((await req('/dueno',undefined,'','GET')).status,401);
  for (const [method,url] of [['POST','/mascotas'],['PUT',`/mascotas/${pet.id}`],['DELETE',`/mascotas/${pet.id}`],['POST',`/admin/duenos/${owner.id}/mascotas/${pet.id}/reportes`]]) {
    assert.equal((await req(url,{nombre:'Prohibida',especie:'gato',edad:1},cookie,method)).status,403);
  }
  assert.equal((await req('/auth/me',undefined,adminCookie,'GET')).status,200);
  console.log('OK: alta pendiente, primer ingreso, validación doble, activación concurrente, login posterior, privacidad y solo lectura.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  if(ids.length) { await pool.query('DELETE FROM mascotas WHERE usuario_id=ANY($1::int[])',[ids]); await pool.query('DELETE FROM usuarios WHERE id=ANY($1::int[])',[ids]); }
  if(server) await new Promise(resolve=>server.close(resolve));
  await pool.end();
});
