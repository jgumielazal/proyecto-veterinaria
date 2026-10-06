import express = require("express");
import mascotasNegocio = require("../negocio/mascotas.negocio");

export = function crearMascotasRouter(negocio: ReturnType<typeof mascotasNegocio.crearMascotasNegocio>) {
  const router = express.Router();

  function responderError(res: express.Response, error: unknown, mensaje: string, log: string) {
    if (error instanceof mascotasNegocio.ErrorMascotas) {
      res.status(error.motivo === "datos_invalidos" ? 400 : 404).json({ error: error.message });
      return;
    }
    console.error(log, error);
    res.status(503).json({ error: mensaje });
  }

  router.get("/", async (_req, res) => {
    try {
      res.status(200).json(await negocio.listar(res.locals.usuario.id));
    } catch (error) {
      responderError(res, error, "No se pudieron obtener las mascotas", "No se pudieron consultar las mascotas:");
    }
  });

  router.post("/", async (req, res) => {
    try {
      res.status(201).json(await negocio.crear(req.body, res.locals.usuario.id));
    } catch (error) {
      responderError(res, error, "No se pudo crear la mascota", "No se pudo crear la mascota:");
    }
  });

  router.put("/:id", async (req, res) => {
    try {
      res.status(200).json(await negocio.editar(req.params.id, req.body, res.locals.usuario.id));
    } catch (error) {
      responderError(res, error, "No se pudo editar la mascota", "No se pudo editar la mascota:");
    }
  });

  router.delete("/:id", async (req, res) => {
    try {
      await negocio.darDeBaja(req.params.id, res.locals.usuario.id);
      res.status(204).end();
    } catch (error) {
      responderError(res, error, "No se pudo dar de baja la mascota", "No se pudo dar de baja la mascota:");
    }
  });

  return router;
};
