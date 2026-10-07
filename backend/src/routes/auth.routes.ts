import express = require("express");
import authNegocio = require("../negocio/auth.negocio");

const cookieOptions = {
  httpOnly: true, sameSite: "strict" as const, path: "/",
  secure: process.env.NODE_ENV === "production",
};
function token(req: express.Request) {
  return req.headers.cookie?.split(";").map(c => c.trim()).find(c => c.startsWith("sesion="))?.slice(7) ?? "";
}

export = function configurarAuthRoutes(app: express.Express, negocio: ReturnType<typeof authNegocio.crearAuthNegocio>) {
  function responderError(res: express.Response, error: unknown, mensaje: string, log?: string) {
    if (error instanceof authNegocio.ErrorAuth) {
      const estados = {
        dni_registrado: 409, no_encontrado: 404, datos_invalidos: 400, credenciales_invalidas: 401, email_registrado: 409,
        sesion_invalida: 401, sesion_vencida: 401,
      };
      res.status(estados[error.motivo]).json({ error: error.message });
      return;
    }
    if (log) console.error(log, error);
    res.status(503).json({ error: mensaje });
  }

  // Las escrituras requieren un encabezado que un formulario externo no puede enviar.
  app.use((req, res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.get("X-Requested-With") !== "veterinaria") {
      res.status(403).json({ error: "Solicitud no permitida" }); return;
    }
    next();
  });

  app.use("/auth", (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  for (const accion of ["registro", "login"] as const) {
    app.post(`/auth/${accion}`, async (req, res) => {
      try {
        const sesion = await negocio.acceder(accion, req.body);
        res.cookie("sesion", sesion.token, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
        res.status(accion === "registro" ? 201 : 200).json(sesion.usuario);
      } catch (error) {
        responderError(res, error, "No se pudo completar el acceso", "Error de autenticación:");
      }
    });
  }

  app.post("/auth/logout", async (req, res) => {
    try {
      await negocio.cerrarSesion(token(req));
      res.clearCookie("sesion", cookieOptions);
      res.status(204).end();
    } catch (error) {
      responderError(res, error, "No se pudo cerrar la sesión");
    }
  });

  const autenticar: express.RequestHandler = async (req, res, next) => {
    try {
      res.locals.usuario = await negocio.autenticar(token(req));
      res.set("Cache-Control", "no-store");
      next();
    } catch (error) {
      responderError(res, error, "No se pudo verificar la sesión");
    }
  };
  app.get("/auth/me", autenticar, (_req, res) => { res.json(res.locals.usuario); });
  app.use("/admin", autenticar, (_req, res, next) => {
    if (res.locals.usuario.tipo !== "admin") {
      res.status(403).json({ error: "Solo los administradores pueden acceder a esta función" });
      return;
    }
    next();
  });
  app.put("/admin/duenos/:id/mascotas/:mascotaId", async (req, res) => {
    try { res.json(await negocio.editarMascotaDueno(String(req.params.id), String(req.params.mascotaId), req.body)); }
    catch (error) { responderError(res, error, "No se pudo actualizar la mascota"); }
  });
  app.post("/admin/duenos/:id/mascotas/:mascotaId/reportes", async (req, res) => {
    try { res.status(201).json(await negocio.agregarReporteDueno(String(req.params.id), String(req.params.mascotaId), req.body)); }
    catch (error) { responderError(res, error, "No se pudo guardar el reporte"); }
  });
  app.get("/admin/duenos/:id/mascotas/:mascotaId", async (req, res) => {
    try { res.json(await negocio.obtenerMascotaDueno(String(req.params.id), String(req.params.mascotaId))); }
    catch (error) { responderError(res, error, "No se pudo cargar la mascota"); }
  });
  app.post("/admin/duenos/:id/mascotas", async (req, res) => {
    try { res.status(201).json(await negocio.crearMascotaDueno(String(req.params.id), req.body)); }
    catch (error) { responderError(res, error, "No se pudo añadir la mascota"); }
  });
  app.put("/admin/duenos/:id", async (req, res) => {
    try { res.json(await negocio.editarDueno(String(req.params.id), req.body)); }
    catch (error) { responderError(res, error, "No se pudieron guardar los datos del dueño"); }
  });
  app.get("/admin/duenos/:id", async (req, res) => {
    try { res.json(await negocio.obtenerDueno(String(req.params.id))); }
    catch (error) { responderError(res, error, "No se pudo cargar el detalle del dueño"); }
  });
  app.get("/admin/duenos", async (_req, res) => {
    try { res.json(await negocio.listarDuenos()); }
    catch (error) { responderError(res, error, "No se pudo cargar el listado de dueños"); }
  });
  app.post("/admin/duenos", async (req, res) => {
    try { res.status(201).json(await negocio.crearDueno(req.body)); }
    catch (error) { responderError(res, error, "No se pudo añadir el dueño"); }
  });
  app.post("/admin/veterinarios", async (req, res) => {
    try {
      res.status(201).json(await negocio.crearVeterinario(req.body));
    } catch (error) {
      responderError(res, error, "No se pudo crear el veterinario", "Error al crear veterinario:");
    }
  });
  app.get("/admin/veterinarios", async (_req, res) => {
    try { res.json(await negocio.listarVeterinarios()); }
    catch (error) { responderError(res, error, "No se pudo cargar el listado de veterinarios"); }
  });
  for (const [metodo, accion] of [["get", "ver"], ["put", "editar"], ["delete", "baja"]] as const) {
    app[metodo]("/admin/veterinarios/:id", async (req, res) => {
      try { res.json(await negocio.gestionarVeterinario(accion, String(req.params.id), req.body)); }
      catch (error) { responderError(res, error, "No se pudo completar la operación del veterinario"); }
    });
  }
  app.use("/mascotas", autenticar);
};
