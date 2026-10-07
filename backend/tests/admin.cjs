// Ejecutar: node --require tsx/cjs tests/admin.cjs (desde backend).
// Servidor temporal con las rutas reales; elimina solo las cuentas de esta prueba.
const assert = require('node:assert/strict');
const express = require('express');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const pool = require('../src/db/pool.ts');
const configurarAuth = require('../src/auth.ts');
const dao = require('../src/dao/auth.dao.ts')(pool);
const app = express(); app.use(express.json()); configurarAuth(app, pool);
const ids = [];
const password = 'Prueba-admin-123';
const suffix = crypto.randomUUID();
const server = app.listen(0, '127.0.0.1', async () => {
  const base = `http://127.0.0.1:${server.address().port}`;
  async function req(path, body, cookie, method = 'POST') {
    return fetch(base + path, {method, headers:{'Content-Type':'application/json','X-Requested-With':'veterinaria', Cookie:cookie || ''}, ...(body === undefined ? {} : {body:JSON.stringify(body)})});
  }
  try {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = await promisify(crypto.scrypt)(password,salt,64,{N:131072,r:8,p:1,maxmem:256*1024*1024});
    const admin = await dao.crearUsuario(`admin-${suffix}@example.test`,`${salt}:${hash.toString('hex')}`,'90000001','admin'); ids.push(admin.id);
    const login = await req('/auth/login',{email:admin.email,password}); assert.equal(login.status,200);
    assert.equal((await login.json()).tipo,'admin');
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const body = {dni:'90000002',nombre:' Veterinaria Prueba ',email:`vet-${suffix}@example.test`,password,matricula:' MAT-001 ',especialidad:' Clínica general ',tipo:'admin'};
    assert.equal((await req('/admin/veterinarios',body)).status,401);
    for (const invalid of [{nombre:' '},{email:'mal'},{password:'corta'},{matricula:''},{matricula:123},{nombre:'x'.repeat(151)},{matricula:'x'.repeat(81)},{especialidad:123},{especialidad:'x'.repeat(151)}]) {
      assert.equal((await req('/admin/veterinarios',{...body,...invalid},cookie)).status,400);
    }
    for (const campo of ['dni', 'nombre', 'email', 'password', 'matricula', 'especialidad']) {
      for (const valor of [undefined, null, '', '   ']) {
        assert.equal((await req('/admin/veterinarios',{...body,[campo]:valor},cookie)).status,400,`${campo} obligatorio`);
      }
    }
    for (const dni of ['1234567','123456789','12.34567','abcdefgh',' 12345678','12345678\n',12345678]) {
      assert.equal((await req('/admin/veterinarios',{...body,dni},cookie)).status,400);
    }
    assert.equal((await req('/admin/veterinarios',{...body,dni:'90000001'},cookie)).status,409);
    const created = await req('/admin/veterinarios',body,cookie); assert.equal(created.status,201);
    const vet = await created.json(); ids.push(vet.id); assert.equal(vet.tipo,'veterinario'); assert.equal(vet.password_hash,undefined);
    const row = (await pool.query('SELECT nombre,matricula,especialidad,tipo,password_hash FROM usuarios WHERE id=$1',[vet.id])).rows[0];
    assert.equal(row.especialidad,'Clínica general'); assert.equal(row.nombre,'Veterinaria Prueba'); assert.equal(row.matricula,'MAT-001'); assert.equal(row.tipo,'veterinario'); assert.notEqual(row.password_hash,password);
    assert.equal((await req('/admin/veterinarios',body,cookie)).status,409);
    const vetLogin = await req('/auth/login',{email:vet.email,password}); assert.equal(vetLogin.status,200); assert.equal((await vetLogin.json()).tipo,'veterinario');
    const vetCookie = vetLogin.headers.get('set-cookie').split(';')[0];
    assert.equal((await req('/admin/veterinarios',body,vetCookie)).status,403);
    const ownerBody = {nombre:' Dueño de prueba ',email:`owner-${suffix}@example.test`,dni:'90000003',tipo:'admin'};
    assert.equal((await req('/admin/duenos',ownerBody)).status,401);
    assert.equal((await req('/admin/duenos',ownerBody,vetCookie)).status,403);
    for (const invalid of [{dni:'123'},{email:'mal'},...['', ' ', 'Ana', 'x'.repeat(151), null, 123, undefined].map(nombre=>({nombre}))]) {
      assert.equal((await req('/admin/duenos',{...ownerBody,...invalid},cookie)).status,400);
    }
    const ownerResponse = await req('/admin/duenos',ownerBody,cookie);
    assert.equal(ownerResponse.headers.get('set-cookie'),null);
    assert.equal(ownerResponse.status,201); const owner = await ownerResponse.json(); ids.push(owner.id); assert.equal(owner.tipo,'cliente');
    assert.equal(owner.password_hash,undefined);
    assert.equal((await pool.query('SELECT count(*)::int AS n FROM sesiones WHERE usuario_id=$1',[owner.id])).rows[0].n,0);
    assert.equal((await req('/admin/duenos',ownerBody,cookie)).status,409);
    assert.equal((await req('/admin/duenos',{...ownerBody,email:`another-${suffix}@example.test`},cookie)).status,409);
    assert.equal((await req('/auth/login',{email:owner.email,password})).status,401);
    const publicResponse = await req('/auth/registro',{email:`public-${suffix}@example.test`,dni:'90000006',password});
    assert.equal(publicResponse.status,201);
    const publicOwner = await publicResponse.json(); ids.push(publicOwner.id);
    const ownerCookie = publicResponse.headers.get('set-cookie').split(';')[0];
    assert.equal((await req('/admin/veterinarios',body,ownerCookie)).status,403);
    assert.equal((await req('/admin/duenos',ownerBody,ownerCookie)).status,403);
    assert.equal((await (await req('/auth/me',undefined,cookie,'GET')).json()).tipo,'admin');
    assert.equal((await req('/admin/duenos',undefined,undefined,'GET')).status,401);
    for (const forbidden of [vetCookie, ownerCookie]) {
      assert.equal((await req('/admin/duenos',undefined,forbidden,'GET')).status,403);
    }
    assert.equal((await pool.query('SELECT nombre FROM usuarios WHERE id=$1',[owner.id])).rows[0].nombre,'Dueño de prueba');
    const ownersResponse = await req('/admin/duenos',undefined,cookie,'GET');
    assert.equal(ownersResponse.status,200);
    const owners = await ownersResponse.json();
    assert.deepEqual(owners.find(item=>item.id===owner.id),{id:owner.id,nombre:'Dueño de prueba',dni:'90000003',email:owner.email});
    assert.equal(owners.find(item=>item.id===publicOwner.id).nombre,null);
    assert.ok(!owners.some(item=>item.id===admin.id || item.id===vet.id));
    assert.ok(owners.every(item=>Object.keys(item).sort().join(',')==='dni,email,id,nombre'));
    const ownPet = (await pool.query("INSERT INTO mascotas(nombre,especie,edad,usuario_id) VALUES ('Luna','gato',3,$1) RETURNING id,nombre,especie,edad",[owner.id])).rows[0];
    await pool.query("INSERT INTO mascotas(nombre,especie,edad,usuario_id,activa) VALUES ('Ajena','perro',2,$1,true),('Inactiva','gato',1,$2,false)",[publicOwner.id,owner.id]);
    const ownerPath = `/admin/duenos/${owner.id}`;
    assert.equal((await req(ownerPath,undefined,undefined,'GET')).status,401);
    for (const forbidden of [vetCookie, ownerCookie]) assert.equal((await req(ownerPath,undefined,forbidden,'GET')).status,403);
    for (const bad of ['abc','0','2147483648']) assert.equal((await req(`/admin/duenos/${bad}`,undefined,cookie,'GET')).status,400);
    for (const missing of [admin.id,vet.id,2147483647]) assert.equal((await req(`/admin/duenos/${missing}`,undefined,cookie,'GET')).status,404);
    const detailResponse = await req(ownerPath,undefined,cookie,'GET');
    assert.equal(detailResponse.status,200);
    assert.deepEqual(await detailResponse.json(),{id:owner.id,nombre:'Dueño de prueba',dni:'90000003',email:owner.email,mascotas:[ownPet]});
    assert.equal((await (await req('/auth/me',undefined,cookie,'GET')).json()).id,admin.id);
    const path = `/admin/veterinarios/${vet.id}`;
    const list = await (await req('/admin/veterinarios',undefined,cookie,'GET')).json();
    assert.ok(list.some(item => item.id === vet.id && item.activo));
    assert.ok(list.every(item => item.tipo === 'veterinario' && !('password_hash' in item)));
    for (const method of ['GET', 'PUT', 'DELETE']) {
      assert.equal((await req(path,method === 'PUT' ? body : undefined,undefined,method)).status,401);
      assert.equal((await req(path,method === 'PUT' ? body : undefined,vetCookie,method)).status,403);
      assert.equal((await req(`/admin/veterinarios/${owner.id}`,method === 'PUT' ? body : undefined,cookie,method)).status,404);
    }
    assert.equal((await req('/admin/veterinarios/no-valido',undefined,cookie,'GET')).status,400);
    const perfil = await (await req(path,undefined,cookie,'GET')).json();
    assert.equal(perfil.nombre,'Veterinaria Prueba'); assert.equal(perfil.activo,true);
    assert.equal(perfil.password_hash,undefined); assert.equal(perfil.dni,body.dni);
    assert.equal((await req(path,{...body,dni:'90000001'},cookie,'PUT')).status,409);
    assert.equal((await req(path,{...body,dni:'123'},cookie,'PUT')).status,400);
    assert.equal((await req(path,{...body,nombre:''},cookie,'PUT')).status,400);
    assert.equal((await req(path,{...body,email:admin.email},cookie,'PUT')).status,409);
    const edited = await req(path,{...body,nombre:'Nombre actualizado',matricula:'MAT-002',activo:false,tipo:'admin'},cookie,'PUT');
    assert.equal(edited.status,200);
    const updated = await edited.json(); assert.equal(updated.nombre,'Nombre actualizado'); assert.equal(updated.matricula,'MAT-002'); assert.equal(updated.activo,true); assert.equal(updated.tipo,'veterinario');
    assert.equal((await req('/auth/login',{email:vet.email,password})).status,200);
    const baja = await req(path,undefined,cookie,'DELETE'); assert.equal(baja.status,200); assert.equal((await baja.json()).activo,false);
    assert.equal((await req(path,undefined,cookie,'DELETE')).status,200);
    const persisted = (await pool.query('SELECT activo,nombre FROM usuarios WHERE id=$1',[vet.id])).rows[0];
    assert.equal(persisted.activo,false); assert.equal(persisted.nombre,'Nombre actualizado');
    assert.equal((await req('/auth/me',undefined,vetCookie,'GET')).status,401);
    assert.equal((await req('/auth/login',{email:vet.email,password})).status,401);
    const after = await (await req('/admin/veterinarios',undefined,cookie,'GET')).json();
    assert.ok(after.some(item => item.id === vet.id && !item.activo));
    await pool.query("UPDATE usuarios SET tipo='cliente' WHERE id=$1",[admin.id]);
    assert.equal((await req('/admin/veterinarios',body,cookie)).status,403);
    assert.equal((await req('/auth/login',{email:vet.email,password:'incorrecta'})).status,401);
    console.log('OK: creación, listado, perfil, edición, validaciones, permisos, baja lógica persistente y bloqueo de acceso/sesiones de inactivos.');
  } catch(e) { console.error(e); process.exitCode=1; }
  finally { if(ids.length) { await pool.query('DELETE FROM mascotas WHERE usuario_id=ANY($1::int[])',[ids]); await pool.query('DELETE FROM usuarios WHERE id=ANY($1::int[])',[ids]); } server.close(); await pool.end(); }
});
