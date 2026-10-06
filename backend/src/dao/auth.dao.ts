import pg = require("pg");

type TipoUsuario = "cliente" | "veterinario" | "admin";

type Usuario = { id: number; email: string };
type Credenciales = Usuario & { password_hash: string };

export = function crearAuthDao(pool: pg.Pool) {
  return {
    async crearUsuario(email: string, hash: string, tipo: TipoUsuario = "cliente") {
      const result = await pool.query<Usuario>("INSERT INTO usuarios (email, password_hash, tipo) VALUES ($1, $2, $3) RETURNING id, email", [email, hash, tipo]);
      return result.rows[0]!;
    },
    async buscarUsuario(email: string) {
      const result = await pool.query<Credenciales>("SELECT id, email, password_hash FROM usuarios WHERE email = $1", [email]);
      return result.rows[0];
    },
    async crearSesion(tokenHash: string, usuarioId: number) {
      await pool.query("INSERT INTO sesiones (token_hash, usuario_id, expira) VALUES ($1, $2, NOW() + INTERVAL '7 days')", [tokenHash, usuarioId]);
    },
    async eliminarSesion(tokenHash: string) {
      await pool.query("DELETE FROM sesiones WHERE token_hash = $1", [tokenHash]);
    },
    async buscarSesion(tokenHash: string) {
      const result = await pool.query<Usuario>("SELECT u.id, u.email FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id WHERE s.token_hash = $1 AND s.expira > NOW()", [tokenHash]);
      return result.rows[0];
    },
  };
};
