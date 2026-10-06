// Ejecutar con PostgreSQL, backend y Vite activos: node backend/tests/auth.cjs
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const { createHash } = require('node:crypto');
const pool = new Pool({host:'127.0.0.1', user:'veterinaria', password:'veterinaria_local', database:'veterinaria'});
const origin = process.env.TEST_URL || 'http://localhost:5173/api';
const emails = [`test-${Date.now()}-a@example.test`, `test-${Date.now()}-b@example.test`];
const password = 'Prueba-segura-123';
const ids = [];
async function req(path, method='GET', body, cookie='') {
  return fetch(origin+path,{method,headers:{'Content-Type':'application/json','X-Requested-With':'veterinaria',Cookie:cookie},...(body === undefined ? {} : {body:JSON.stringify(body)})});
}
(async () => {
  for (const method of ['GET','POST','PUT','DELETE']) assert.equal((await req('/mascotas'+(['PUT','DELETE'].includes(method)?'/1':''),method)).status,401);
  assert.equal((await req('/auth/registro','POST',{email:'mal',password:'corta'})).status,400);
  for (const cookie of ['', 'sesion=invalida', 'sesion='+'a'.repeat(64)]) {
    const respuesta = await req('/auth/me','GET',undefined,cookie);
    assert.equal(respuesta.status,401);
    assert.equal(respuesta.headers.get('cache-control'),'no-store');
    assert.deepEqual(await respuesta.json(),{error:cookie.endsWith('a'.repeat(64))
      ? 'La sesión venció. Iniciá sesión nuevamente.' : 'Iniciá sesión para continuar'});
  }
  const desconocido = await req('/auth/login','POST',{email:'inexistente-'+Date.now()+'@example.test',password});
  assert.equal(desconocido.status,401);
  assert.deepEqual(await desconocido.json(),{error:'Email o contraseña incorrectos'});
  const cookies=[];
  for (const email of emails) {
    const r=await req('/auth/registro','POST',{email,password}); assert.equal(r.status,201);
    assert.match(r.headers.get('set-cookie'),/HttpOnly/i);
    assert.match(r.headers.get('set-cookie'),/SameSite=Strict/i);
    assert.match(r.headers.get('set-cookie'),/Max-Age=604800/i);
    const usuario = await r.json();
    assert.deepEqual(Object.keys(usuario).sort(),['email','id']);
    assert.equal(usuario.email,email);
    ids.push(usuario.id); cookies.push(r.headers.get('set-cookie').split(';')[0]);
    const token = cookies.at(-1).slice('sesion='.length);
    const sesion = await pool.query('SELECT token_hash, expira > NOW() AS vigente FROM sesiones WHERE usuario_id=$1',[usuario.id]);
    assert.deepEqual(sesion.rows,[{token_hash:createHash('sha256').update(token).digest('hex'),vigente:true}]);
    const me = await req('/auth/me','GET',undefined,cookies.at(-1));
    assert.equal(me.status,200); assert.deepEqual(await me.json(),usuario);
  }
  assert.equal((await req('/auth/registro','POST',{email:emails[0].toUpperCase(),password})).status,409);
  assert.equal((await req('/auth/login','POST',{email:emails[0],password:'incorrecta'})).status,401);
  assert.equal((await req('/auth/me','GET',undefined,cookies[0])).status,200);
  assert.deepEqual(await (await req('/mascotas','GET',undefined,cookies[0])).json(),[]);
  const errorDatos = {error:'Nombre y especie son obligatorios. Edad debe ser un número entero entre 0 y 2147483647.'};
  for (const datos of [{}, {nombre:' ',especie:'gato',edad:1}, {nombre:'Prueba',especie:' ',edad:1},
    ...[-1, 1.5, 2147483648, '2', null].map(edad => ({nombre:'Prueba',especie:'gato',edad}))]) {
    const respuesta = await req('/mascotas','POST',datos,cookies[0]);
    assert.equal(respuesta.status,400); assert.deepEqual(await respuesta.json(),errorDatos);
  }
  for (const id of ['0','-1','1.5','abc','2147483648']) {
    for (const method of ['PUT','DELETE']) {
      const respuesta = await req('/mascotas/'+id,method,{},cookies[0]);
      assert.equal(respuesta.status,400);
      assert.deepEqual(await respuesta.json(),{error:'El id debe ser un entero positivo válido'});
    }
  }
  let r=await req('/mascotas','POST',{nombre:' Propia ',especie:' gato ',edad:0,usuario_id:ids[1]},cookies[0]);
  assert.equal(r.status,201); const mascota=await r.json();
  assert.deepEqual(mascota,{id:mascota.id,nombre:'Propia',especie:'gato',edad:0});
  assert.deepEqual(await (await req('/mascotas','GET',undefined,cookies[1])).json(),[]);
  for (const method of ['PUT','DELETE']) assert.equal((await req('/mascotas/'+mascota.id,method,{nombre:'Ajena',especie:'perro',edad:2},cookies[1])).status,404);
  assert.equal((await req('/mascotas/'+mascota.id,'PUT',{nombre:'',especie:'gato',edad:-1},cookies[0])).status,400);
  r=await req('/mascotas/'+mascota.id,'PUT',{nombre:'Editada',especie:'gato',edad:2},cookies[0]); assert.equal(r.status,200); assert.equal((await r.json()).nombre,'Editada');
  assert.equal((await req('/mascotas/'+mascota.id,'DELETE',undefined,cookies[0])).status,204);
  assert.deepEqual(await (await req('/mascotas','GET',undefined,cookies[0])).json(),[]);
  for (const method of ['PUT','DELETE']) {
    const respuesta = await req('/mascotas/'+mascota.id,method,{nombre:'Inactiva',especie:'gato',edad:1},cookies[0]);
    assert.equal(respuesta.status,404);
    assert.deepEqual(await respuesta.json(),{error:'Mascota no encontrada'});
  }
  const db=await pool.query('SELECT activa, usuario_id FROM mascotas WHERE id=$1',[mascota.id]); assert.deepEqual(db.rows[0],{activa:false,usuario_id:ids[0]});
  const logout = await req('/auth/logout','POST',undefined,cookies[0]);
  assert.equal(logout.status,204);
  assert.equal(await logout.text(),'');
  assert.match(logout.headers.get('set-cookie'),/sesion=;.*Expires=Thu, 01 Jan 1970/i);
  assert.equal((await pool.query('SELECT token_hash FROM sesiones WHERE usuario_id=$1',[ids[0]])).rowCount,0);
  assert.equal((await req('/auth/me','GET',undefined,cookies[0])).status,401);
  r=await req('/auth/login','POST',{email:emails[0].toUpperCase(),password}); assert.equal(r.status,200); const fresh=r.headers.get('set-cookie').split(';')[0];
  assert.equal((await req('/auth/me','GET',undefined,fresh)).status,200);
  await pool.query('UPDATE sesiones SET expira=NOW()-INTERVAL \'1 second\' WHERE usuario_id=$1',[ids[0]]);
  assert.equal((await req('/mascotas','GET',undefined,fresh)).status,401);
  const vencida = await req('/auth/me','GET',undefined,fresh);
  assert.equal(vencida.status,401);
  assert.deepEqual(await vencida.json(),{error:'La sesión venció. Iniciá sesión nuevamente.'});
  assert.equal((await req('/auth/me','GET',undefined,cookies[1])).status,200);
  assert.equal((await fetch(origin+'/auth/logout',{method:'POST',headers:{Cookie:cookies[1]}})).status,403);
  // Registro y login comparten el límite; una sesión vigente sigue funcionando.
  let limitada;
  for (let i=0; i<21; i++) {
    limitada = await req(i % 2 ? '/auth/login' : '/auth/registro','POST',{});
    if (limitada.status === 429) break;
    assert.equal(limitada.status,400);
  }
  assert.equal(limitada.status,429);
  assert.deepEqual(await limitada.json(),{error:'Demasiados intentos. Esperá 15 minutos antes de volver a intentar.'});
  assert.equal((await req('/auth/me','GET',undefined,cookies[1])).status,200);
  assert.equal((await req('/auth/logout','POST',undefined,cookies[1])).status,204);
  console.log('OK: registro, login, validaciones, cookies, CRUD propio, aislamiento entre usuarios, logout, expiración y protección CSRF.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  // Solo elimina registros de las cuentas efímeras creadas por esta prueba.
  if(ids.length) {await pool.query('DELETE FROM mascotas WHERE usuario_id = ANY($1::int[])',[ids]); await pool.query('DELETE FROM usuarios WHERE id = ANY($1::int[])',[ids]);}
  await pool.end();
});
