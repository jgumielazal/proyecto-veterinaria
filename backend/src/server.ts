import express = require("express");
import pg = require("pg");

import configurarAuth = require("./auth");
import crearMascotasDao = require("./dao/mascotas.dao");
import mascotasNegocio = require("./negocio/mascotas.negocio");
import crearMascotasRouter = require("./routes/mascotas.routes");

const app = express();
app.use(express.json());
const pool = new pg.Pool({
  ...(process.env.DATABASE_URL
    ? { connectionString: process.env.DATABASE_URL }
    : {
        host: "127.0.0.1",
        port: 5432,
        user: "veterinaria",
        password: "veterinaria_local",
        database: "veterinaria",
      }),
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

const mascotasDao = crearMascotasDao(pool);
const negocio = mascotasNegocio.crearMascotasNegocio(mascotasDao);
app.use("/mascotas", crearMascotasRouter(negocio));

const port = Number(process.env.PORT ?? 3001);
app.listen(port, "0.0.0.0", () => {
  console.log(`Servidor escuchando en http://0.0.0.0:${port}`);
});
