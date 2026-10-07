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
    async editarMascotaDueno(duenoId: number, mascotaId: number, datos: { nombre: string; especie: string; edad: number; fecha: string | null }) {
      return (await pool.query(
        `UPDATE mascotas m SET nombre=$3,especie=$4,edad=$5,fecha=$6::date FROM usuarios u
         WHERE m.id=$1 AND m.usuario_id=$2 AND m.activa=true AND u.id=m.usuario_id AND u.tipo='cliente'
         RETURNING m.id,m.nombre,m.especie,m.edad,m.raza,m.pedigree,m.descripcion,to_char(m.fecha,'YYYY-MM-DD') AS fecha`,
        [mascotaId,duenoId,datos.nombre,datos.especie,datos.edad,datos.fecha]
      )).rows[0];
    },
    async agregarReporteDueno(duenoId: number, mascotaId: number, texto: string, fecha: string) {
      return (await pool.query(
        `INSERT INTO reportes_mascotas(mascota_id,texto,fecha)
         SELECT m.id,$3,$4::date FROM mascotas m JOIN usuarios u ON u.id=m.usuario_id
         WHERE m.id=$1 AND m.usuario_id=$2 AND m.activa=true AND u.tipo='cliente'
         RETURNING id,texto,to_char(fecha,'YYYY-MM-DD') AS fecha`, [mascotaId,duenoId,texto,fecha]
      )).rows[0];
    },
    async obtenerMascotaDueno(duenoId: number, mascotaId: number) {
      const mascota = (await pool.query(
        `SELECT m.id,m.nombre,m.especie,m.edad,m.raza,m.pedigree,m.descripcion,to_char(m.fecha,'YYYY-MM-DD') AS fecha
         FROM mascotas m JOIN usuarios u ON u.id=m.usuario_id
         WHERE m.id=$1 AND m.usuario_id=$2 AND m.activa=true AND u.tipo='cliente'`, [mascotaId,duenoId]
      )).rows[0];
      if (!mascota) return undefined;
      const reportes = (await pool.query(
        "SELECT id,texto,to_char(fecha,'YYYY-MM-DD') AS fecha FROM reportes_mascotas WHERE mascota_id=$1 ORDER BY fecha DESC NULLS LAST,id DESC", [mascotaId]
      )).rows;
      return { ...mascota, reportes };
    },
    async crearMascotaDueno(id: number, datos: { nombre: string; especie: string; edad: number; raza: string; pedigree: boolean; descripcion: string; reporte: string; fecha: string }) {
      return (await pool.query<{ id: number; nombre: string; especie: string; edad: number }>(
        `WITH nueva AS (
          INSERT INTO mascotas(nombre,especie,edad,raza,pedigree,descripcion,reporte,fecha,usuario_id)
          SELECT $2,$3,$4,$5,$6,$7,$8,$9::date,id FROM usuarios WHERE id=$1 AND tipo='cliente'
          RETURNING id,nombre,especie,edad,reporte,fecha
        ), registro AS (
          INSERT INTO reportes_mascotas(mascota_id,texto,fecha)
          SELECT id,reporte,fecha FROM nueva WHERE btrim(reporte) <> ''
        ) SELECT id,nombre,especie,edad FROM nueva`,
        [id,datos.nombre,datos.especie,datos.edad,datos.raza,datos.pedigree,datos.descripcion,datos.reporte,datos.fecha]
      )).rows[0];
    },
    async editarDueno(id: number, nombre: string, dni: string, email: string) {
      return (await pool.query<{ id: number; nombre: string; dni: string; email: string }>(
        "UPDATE usuarios SET nombre=$2, dni=$3, email=$4 WHERE id=$1 AND tipo='cliente' RETURNING id, nombre, dni, email",
        [id, nombre, dni, email]
      )).rows[0];
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
