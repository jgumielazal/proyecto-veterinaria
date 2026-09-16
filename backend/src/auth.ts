import express = require("express");
import pg = require("pg");
import crypto = require("node:crypto");

const cookieOptions = {
  httpOnly: true, sameSite: "strict" as const, path: "/",
  secure: process.env.NODE_ENV === "production",
};
const digest = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
function token(req: express.Request) {
  return req.headers.cookie?.split(";").map(c => c.trim()).find(c => c.startsWith("sesion="))?.slice(7) ?? "";
}
function derivar(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error); else resolve(key);
    });
  });
}

export = function configurarAuth(app: express.Express, pool: pg.Pool) {
  // Las escrituras requieren un encabezado que un formulario externo no puede enviar.
  app.use((req, res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method) && req.get("X-Requested-With") !== "veterinaria") {
      res.status(403).json({ error: "Solicitud no permitida" }); return;
    }
    next();
  });

  // Límite sencillo por IP para intentos de acceso; se reinicia con el servidor.
  const intentos = new Map<string, { cantidad: number; hasta: number }>();
  app.use("/auth", (_req, res, next) => { res.set("Cache-Control", "no-store"); next(); });
  const limitar: express.RequestHandler = (req, res, next) => {
    const ahora = Date.now();
    for (const [ip, valor] of intentos) if (valor.hasta <= ahora) intentos.delete(ip);
    const ip = req.ip ?? "local";
    const valor = intentos.get(ip) ?? { cantidad: 0, hasta: ahora + 15 * 60 * 1000 };
    if (valor.cantidad >= 20 || (!intentos.has(ip) && intentos.size >= 10000)) {
      res.status(429).json({ error: "Demasiados intentos. Esperá 15 minutos antes de volver a intentar." }); return;
    }
    valor.cantidad++; intentos.set(ip, valor); next();
  };

  for (const accion of ["registro", "login"] as const) {
    app.post(`/auth/${accion}`, limitar, async (req, res) => {
      const { email, password } = req.body ?? {};
      if (typeof email !== "string" || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
          typeof password !== "string" || password.trim().length < 8 || password.length > 128) {
        res.status(400).json({ error: "Ingresá un email válido y una contraseña de entre 8 y 128 caracteres." }); return;
      }
      try {
        const normalizado = email.trim().toLowerCase();
        let usuario;
        if (accion === "registro") {
          const salt = crypto.randomBytes(16).toString("hex");
          const hash = `${salt}:${(await derivar(password, salt)).toString("hex")}`;
          const result = await pool.query("INSERT INTO usuarios (email, password_hash) VALUES ($1, $2) RETURNING id, email", [normalizado, hash]);
          usuario = result.rows[0];
        } else {
          const result = await pool.query("SELECT id, email, password_hash FROM usuarios WHERE email = $1", [normalizado]);
          const row = result.rows[0];
          const [salt, esperado] = (row?.password_hash ?? `${"0".repeat(32)}:${"0".repeat(128)}`).split(":");
          const obtenido = await derivar(password, salt);
          if (!crypto.timingSafeEqual(obtenido, Buffer.from(esperado, "hex")) || !row) {
            res.status(401).json({ error: "Email o contraseña incorrectos" }); return;
          }
          usuario = { id: row.id, email: row.email };
        }
        const valor = crypto.randomBytes(32).toString("hex");
        await pool.query("INSERT INTO sesiones (token_hash, usuario_id, expira) VALUES ($1, $2, NOW() + INTERVAL '7 days')", [digest(valor), usuario.id]);
        res.cookie("sesion", valor, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
        res.status(accion === "registro" ? 201 : 200).json(usuario);
      } catch (error) {
        if ((error as { code?: string }).code === "23505") {
          res.status(409).json({ error: "Ese email ya está registrado" }); return;
        }
        console.error("Error de autenticación:", error);
        res.status(503).json({ error: "No se pudo completar el acceso" });
      }
    });
  }

  app.post("/auth/logout", async (req, res) => {
    try {
      await pool.query("DELETE FROM sesiones WHERE token_hash = $1", [digest(token(req))]);
      res.clearCookie("sesion", cookieOptions);
      res.status(204).end();
    } catch {
      res.status(503).json({ error: "No se pudo cerrar la sesión" });
    }
  });

  const autenticar: express.RequestHandler = async (req, res, next) => {
    const valor = token(req);
    if (!/^[a-f0-9]{64}$/.test(valor)) { res.status(401).json({ error: "Iniciá sesión para continuar" }); return; }
    try {
      const result = await pool.query("SELECT u.id, u.email FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id WHERE s.token_hash = $1 AND s.expira > NOW()", [digest(valor)]);
      if (!result.rows[0]) { res.status(401).json({ error: "La sesión venció. Iniciá sesión nuevamente." }); return; }
      res.locals.usuario = result.rows[0];
      res.set("Cache-Control", "no-store");
      next();
    } catch {
      res.status(503).json({ error: "No se pudo verificar la sesión" });
    }
  };
  app.get("/auth/me", autenticar, (_req, res) => { res.json(res.locals.usuario); });
  app.use("/mascotas", autenticar);
};
