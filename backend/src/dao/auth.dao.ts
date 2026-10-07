import pg = require("pg");
import crearMascotasDao = require("./mascotas.dao");

type TipoUsuario = "cliente" | "veterinario" | "admin";

type Usuario = { id: number; email: string; tipo: TipoUsuario };
type Veterinario = Usuario & { dni: string; nombre: string; matricula: string; especialidad: string; activo: boolean };
type Credenciales = Usuario & { password_hash: string };

export = function crearAuthDao(pool: pg.Pool) {
  return {
    async crearUsuario(email: string, hash: string, dni: string, tipo: TipoUsuario = "cliente", nombre: string | null = null) {
      const result = await pool.query<Usuario>("INSERT INTO usuarios (email, password_hash, dni, tipo, nombre) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, tipo", [email, hash, dni, tipo, nombre]);
      return result.rows[0]!;
    },
    async crearVeterinario(nombre: string, email: string, hash: string, matricula: string, especialidad: string, dni: string) {
      const result = await pool.query<Usuario>("INSERT INTO usuarios (nombre, email, password_hash, matricula, especialidad, dni, tipo) VALUES ($1, $2, $3, $4, $5, $6, 'veterinario') RETURNING id, email, tipo", [nombre, email, hash, matricula, especialidad, dni]);
      return result.rows[0]!;
    },
    async obtenerDueno(id: number) {
      const dueno = (await pool.query<{ id: number; nombre: string | null; dni: string; email: string }>(
        "SELECT id, nombre, dni, email FROM usuarios WHERE id = $1 AND tipo = 'cliente'", [id]
      )).rows[0];
      if (!dueno) return undefined;
      return { ...dueno, mascotas: await crearMascotasDao(pool).listar(id) };
    },
    async listarDuenos() {
      return (await pool.query<{ id: number; nombre: string | null; dni: string; email: string }>(
        "SELECT id, nombre, dni, email FROM usuarios WHERE tipo = 'cliente' ORDER BY nombre NULLS LAST, id"
      )).rows;
    },
    async listarVeterinarios() {
      return (await pool.query<Veterinario>("SELECT id, nombre, email, dni, tipo, matricula, especialidad, activo FROM usuarios WHERE tipo = 'veterinario' ORDER BY nombre, id")).rows;
    },
    async obtenerVeterinario(id: number) {
      return (await pool.query<Veterinario>("SELECT id, nombre, email, dni, tipo, matricula, especialidad, activo FROM usuarios WHERE id = $1 AND tipo = 'veterinario'", [id])).rows[0];
    },
    async editarVeterinario(id: number, nombre: string, email: string, matricula: string, especialidad: string, dni: string) {
      return (await pool.query<Veterinario>("UPDATE usuarios SET nombre = $2, email = $3, matricula = $4, especialidad = $5, dni = $6 WHERE id = $1 AND tipo = 'veterinario' RETURNING id, nombre, email, dni, tipo, matricula, especialidad, activo", [id, nombre, email, matricula, especialidad, dni])).rows[0];
    },
    async bajaVeterinario(id: number) {
      return (await pool.query<Veterinario>("UPDATE usuarios SET activo = false WHERE id = $1 AND tipo = 'veterinario' RETURNING id, nombre, email, dni, tipo, matricula, especialidad, activo", [id])).rows[0];
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
