import express = require("express");
import pg = require("pg");

import configurarAuth = require("./auth");

const app = express();
app.use(express.json());
const pool = new pg.Pool({
  host: "127.0.0.1",
  port: 5432,
  user: "veterinaria",
  password: "veterinaria_local",
  database: "veterinaria",
  connectionTimeoutMillis: 3000,
  query_timeout: 3000,
});

pool.on("error", (error) => {
  console.error("Error de conexión con PostgreSQL:", error.message);
});

app.get("/health", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({ status: "ok" });
  } catch (error) {
    console.error("No se pudo consultar PostgreSQL:", error);
    res.status(503).json({ status: "error" });
  }
});

configurarAuth(app, pool);

app.get("/mascotas", async (_req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, nombre, especie, edad FROM mascotas WHERE activa = TRUE AND usuario_id = $1 ORDER BY id",
      [res.locals.usuario.id],
    );
    res.status(200).json(result.rows);
  } catch (error) {
    console.error("No se pudieron consultar las mascotas:", error);
    res.status(503).json({ error: "No se pudieron obtener las mascotas" });
  }
});

app.post("/mascotas", async (req, res) => {
  const { nombre, especie, edad } = req.body ?? {};

  if (
    typeof nombre !== "string" || nombre.trim() === "" ||
    typeof especie !== "string" || especie.trim() === "" ||
    !Number.isInteger(edad) || edad < 0 || edad > 2147483647
  ) {
    res.status(400).json({
      error: "Nombre y especie son obligatorios. Edad debe ser un número entero entre 0 y 2147483647.",
    });
    return;
  }

  try {
    const result = await pool.query(
      "INSERT INTO mascotas (nombre, especie, edad, usuario_id) VALUES ($1, $2, $3, $4) RETURNING id, nombre, especie, edad",
      [nombre.trim(), especie.trim(), edad, res.locals.usuario.id],
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error("No se pudo crear la mascota:", error);
    res.status(503).json({ error: "No se pudo crear la mascota" });
  }
});

app.put("/mascotas/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!/^\d+$/.test(req.params.id) || !Number.isInteger(id) || id < 1 || id > 2147483647) {
    res.status(400).json({ error: "El id debe ser un entero positivo válido" });
    return;
  }

  const { nombre, especie, edad } = req.body ?? {};
  if (
    typeof nombre !== "string" || nombre.trim() === "" ||
    typeof especie !== "string" || especie.trim() === "" ||
    !Number.isInteger(edad) || edad < 0 || edad > 2147483647
  ) {
    res.status(400).json({
      error: "Nombre y especie son obligatorios. Edad debe ser un número entero entre 0 y 2147483647.",
    });
    return;
  }

  try {
    const result = await pool.query(
      "UPDATE mascotas SET nombre = $1, especie = $2, edad = $3 WHERE id = $4 AND activa = TRUE AND usuario_id = $5 RETURNING id, nombre, especie, edad",
      [nombre.trim(), especie.trim(), edad, id, res.locals.usuario.id],
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: "Mascota no encontrada" });
      return;
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("No se pudo editar la mascota:", error);
    res.status(503).json({ error: "No se pudo editar la mascota" });
  }
});

app.delete("/mascotas/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!/^\d+$/.test(req.params.id) || !Number.isInteger(id) || id < 1 || id > 2147483647) {
    res.status(400).json({ error: "El id debe ser un entero positivo válido" });
    return;
  }

  try {
    const result = await pool.query(
      "UPDATE mascotas SET activa = FALSE WHERE id = $1 AND activa = TRUE AND usuario_id = $2",
      [id, res.locals.usuario.id],
    );
    if (result.rowCount === 0) {
      res.status(404).json({ error: "Mascota no encontrada" });
      return;
    }
    res.status(204).end();
  } catch (error) {
    console.error("No se pudo dar de baja la mascota:", error);
    res.status(503).json({ error: "No se pudo dar de baja la mascota" });
  }
});

app.listen(3001, () => {
  console.log("Servidor escuchando en http://localhost:3001");
});
