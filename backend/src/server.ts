import express = require("express");
import pool = require("./db/pool");

import configurarAuth = require("./auth");
import crearMascotasDao = require("./dao/mascotas.dao");
import mascotasNegocio = require("./negocio/mascotas.negocio");
import crearMascotasRouter = require("./routes/mascotas.routes");

const app = express();
app.use(express.json());
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
