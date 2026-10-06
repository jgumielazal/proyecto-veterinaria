// Ejecutar con PostgreSQL, backend y Vite activos: node backend/tests/auth.cjs
const assert = require('node:assert/strict');
const { Pool } = require('pg');
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
  const cookies=[];
  for (const email of emails) {
    const r=await req('/auth/registro','POST',{email,password}); assert.equal(r.status,201);
    assert.match(r.headers.get('set-cookie'),/HttpOnly/i);
    assert.match(r.headers.get('set-cookie'),/SameSite=Strict/i);
    ids.push((await r.json()).id); cookies.push(r.headers.get('set-cookie').split(';')[0]);
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
  assert.equal((await req('/auth/logout','POST',undefined,cookies[0])).status,204);
  assert.equal((await req('/auth/me','GET',undefined,cookies[0])).status,401);
  r=await req('/auth/login','POST',{email:emails[0].toUpperCase(),password}); assert.equal(r.status,200); const fresh=r.headers.get('set-cookie').split(';')[0];
  assert.equal((await req('/auth/me','GET',undefined,fresh)).status,200);
  await pool.query('UPDATE sesiones SET expira=NOW()-INTERVAL \'1 second\' WHERE usuario_id=$1',[ids[0]]);
  assert.equal((await req('/mascotas','GET',undefined,fresh)).status,401);
  assert.equal((await fetch(origin+'/auth/logout',{method:'POST',headers:{Cookie:cookies[1]}})).status,403);
  console.log('OK: registro, login, validaciones, cookies, CRUD propio, aislamiento entre usuarios, logout, expiración y protección CSRF.');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{
  // Solo elimina registros de las cuentas efímeras creadas por esta prueba.
  if(ids.length) {await pool.query('DELETE FROM mascotas WHERE usuario_id = ANY($1::int[])',[ids]); await pool.query('DELETE FROM usuarios WHERE id = ANY($1::int[])',[ids]);}
  await pool.end();
});
