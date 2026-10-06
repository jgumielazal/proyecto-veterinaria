import pg = require("pg");

type DatosMascota = { nombre: string; especie: string; edad: number };
type Mascota = DatosMascota & { id: number };

export = function crearMascotasDao(pool: pg.Pool) {
  return {
    async listar(usuarioId: number) {
      const result = await pool.query<Mascota>(
        "SELECT id, nombre, especie, edad FROM mascotas WHERE activa = TRUE AND usuario_id = $1 ORDER BY id",
        [usuarioId],
      );
      return result.rows;
    },
    async crear(datos: DatosMascota, usuarioId: number) {
      const result = await pool.query<Mascota>(
        "INSERT INTO mascotas (nombre, especie, edad, usuario_id) VALUES ($1, $2, $3, $4) RETURNING id, nombre, especie, edad",
        [datos.nombre, datos.especie, datos.edad, usuarioId],
      );
      return result.rows[0];
    },
    async editar(id: number, datos: DatosMascota, usuarioId: number) {
      const result = await pool.query<Mascota>(
        "UPDATE mascotas SET nombre = $1, especie = $2, edad = $3 WHERE id = $4 AND activa = TRUE AND usuario_id = $5 RETURNING id, nombre, especie, edad",
        [datos.nombre, datos.especie, datos.edad, id, usuarioId],
      );
      return result.rows[0];
    },
    async darDeBaja(id: number, usuarioId: number) {
      const result = await pool.query(
        "UPDATE mascotas SET activa = FALSE WHERE id = $1 AND activa = TRUE AND usuario_id = $2",
        [id, usuarioId],
      );
      return result.rowCount !== 0;
    },
  };
};
