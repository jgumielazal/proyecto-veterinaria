import pg = require("pg");

type TipoUsuario = "cliente" | "veterinario" | "admin";

type Usuario = { id: number; email: string; tipo: TipoUsuario };
type Veterinario = Usuario & { nombre: string; matricula: string; especialidad: string; activo: boolean };
type Credenciales = Usuario & { password_hash: string };

export = function crearAuthDao(pool: pg.Pool) {
  return {
    async crearUsuario(email: string, hash: string, tipo: TipoUsuario = "cliente") {
      const result = await pool.query<Usuario>("INSERT INTO usuarios (email, password_hash, tipo) VALUES ($1, $2, $3) RETURNING id, email, tipo", [email, hash, tipo]);
      return result.rows[0]!;
    },
    async crearVeterinario(nombre: string, email: string, hash: string, matricula: string, especialidad: string) {
      const result = await pool.query<Usuario>("INSERT INTO usuarios (nombre, email, password_hash, matricula, especialidad, tipo) VALUES ($1, $2, $3, $4, $5, 'veterinario') RETURNING id, email, tipo", [nombre, email, hash, matricula, especialidad]);
      return result.rows[0]!;
    },
    async listarVeterinarios() {
      return (await pool.query<Veterinario>("SELECT id, nombre, email, tipo, matricula, especialidad, activo FROM usuarios WHERE tipo = 'veterinario' ORDER BY nombre, id")).rows;
    },
    async obtenerVeterinario(id: number) {
      return (await pool.query<Veterinario>("SELECT id, nombre, email, tipo, matricula, especialidad, activo FROM usuarios WHERE id = $1 AND tipo = 'veterinario'", [id])).rows[0];
    },
    async editarVeterinario(id: number, nombre: string, email: string, matricula: string, especialidad: string) {
      return (await pool.query<Veterinario>("UPDATE usuarios SET nombre = $2, email = $3, matricula = $4, especialidad = $5 WHERE id = $1 AND tipo = 'veterinario' RETURNING id, nombre, email, tipo, matricula, especialidad, activo", [id, nombre, email, matricula, especialidad])).rows[0];
    },
    async bajaVeterinario(id: number) {
      return (await pool.query<Veterinario>("UPDATE usuarios SET activo = false WHERE id = $1 AND tipo = 'veterinario' RETURNING id, nombre, email, tipo, matricula, especialidad, activo", [id])).rows[0];
    },
    async buscarUsuario(email: string) {
      const result = await pool.query<Credenciales>("SELECT id, email, tipo, password_hash FROM usuarios WHERE email = $1 AND activo = true", [email]);
      return result.rows[0];
    },
    async crearSesion(tokenHash: string, usuarioId: number) {
      await pool.query("INSERT INTO sesiones (token_hash, usuario_id, expira) VALUES ($1, $2, NOW() + INTERVAL '7 days')", [tokenHash, usuarioId]);
    },
    async eliminarSesion(tokenHash: string) {
      await pool.query("DELETE FROM sesiones WHERE token_hash = $1", [tokenHash]);
    },
    async buscarSesion(tokenHash: string) {
      const result = await pool.query<Usuario>("SELECT u.id, u.email, u.tipo FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id WHERE s.token_hash = $1 AND s.expira > NOW() AND u.activo = true", [tokenHash]);
      return result.rows[0];
    },
  };
};
