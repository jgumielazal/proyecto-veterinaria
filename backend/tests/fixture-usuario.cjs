const crypto = require('node:crypto');
const { promisify } = require('node:util');
module.exports = async function crearUsuario(pool,email,password,dni,tipo='cliente') {
  const salt = crypto.randomBytes(16).toString('hex');
  const key = await promisify(crypto.scrypt)(password,salt,64,{N:131072,r:8,p:1,maxmem:256*1024*1024});
  return (await pool.query("INSERT INTO usuarios(email,password_hash,dni,tipo,estado_activacion) VALUES ($1,$2,$3,$4,'activada') RETURNING id,email,tipo",[email,`${salt}:${key.toString('hex')}`,dni,tipo])).rows[0];
};
