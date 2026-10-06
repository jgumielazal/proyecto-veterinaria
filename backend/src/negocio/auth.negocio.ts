import crypto = require("node:crypto");
import crearAuthDao = require("../dao/auth.dao");

class ErrorAuth extends Error {
  constructor(public readonly motivo: "datos_invalidos" | "credenciales_invalidas" | "email_registrado" | "sesion_invalida" | "sesion_vencida", mensaje: string) {
    super(mensaje);
  }
}

const digest = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
function derivar(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error); else resolve(key);
    });
  });
}

function crearAuthNegocio(dao: ReturnType<typeof crearAuthDao>) {
  return {
    async acceder(accion: "registro" | "login", entrada: unknown) {
      const { email, password } = (entrada ?? {}) as { email?: unknown; password?: unknown };
      if (typeof email !== "string" || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
          typeof password !== "string" || password.trim().length < 8 || password.length > 128) {
        throw new ErrorAuth("datos_invalidos", "Ingresá un email válido y una contraseña de entre 8 y 128 caracteres.");
      }
      try {
        const normalizado = email.trim().toLowerCase();
        let usuario;
        if (accion === "registro") {
          const salt = crypto.randomBytes(16).toString("hex");
          const hash = `${salt}:${(await derivar(password, salt)).toString("hex")}`;
          // El registro público siempre crea dueños; nunca toma el rol de la solicitud.
          usuario = await dao.crearUsuario(normalizado, hash, "cliente");
        } else {
          const row = await dao.buscarUsuario(normalizado);
          const [salt, esperado] = (row?.password_hash ?? `${"0".repeat(32)}:${"0".repeat(128)}`).split(":");
          const obtenido = await derivar(password, salt!);
          if (!crypto.timingSafeEqual(obtenido, Buffer.from(esperado!, "hex")) || !row) {
            throw new ErrorAuth("credenciales_invalidas", "Email o contraseña incorrectos");
          }
          usuario = { id: row.id, email: row.email, tipo: row.tipo };
        }
        const valor = crypto.randomBytes(32).toString("hex");
        await dao.crearSesion(digest(valor), usuario.id);
        return { usuario, token: valor };
      } catch (error) {
        if ((error as { code?: string }).code === "23505") {
          throw new ErrorAuth("email_registrado", "Ese email ya está registrado");
        }
        throw error;
      }
    },
    async crearVeterinario(entrada: unknown) {
      const { nombre, email, password, matricula, especialidad } = (entrada ?? {}) as Record<string, unknown>;
      if (typeof nombre !== "string" || !nombre.trim() || nombre.trim().length > 150 ||
          typeof email !== "string" || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
          typeof password !== "string" || password.trim().length < 8 || password.length > 128 ||
          typeof matricula !== "string" || !matricula.trim() || matricula.trim().length > 80 ||
          typeof especialidad !== "string" || !especialidad.trim() || especialidad.trim().length > 150) {
        throw new ErrorAuth("datos_invalidos", "Ingresá nombre (hasta 150 caracteres), email válido, contraseña de 8 a 128 caracteres, matrícula (hasta 80 caracteres) y especialidad (hasta 150 caracteres).");
      }
      const salt = crypto.randomBytes(16).toString("hex");
      const hash = `${salt}:${(await derivar(password, salt)).toString("hex")}`;
      try {
        return await dao.crearVeterinario(nombre.trim(), email.trim().toLowerCase(), hash, matricula.trim(), especialidad.trim());
      } catch (error) {
        if ((error as { code?: string }).code === "23505") {
          throw new ErrorAuth("email_registrado", "Ese email ya está registrado");
        }
        throw error;
      }
    },
    async cerrarSesion(valor: string) {
      await dao.eliminarSesion(digest(valor));
    },
    async autenticar(valor: string) {
      if (!/^[a-f0-9]{64}$/.test(valor)) {
        throw new ErrorAuth("sesion_invalida", "Iniciá sesión para continuar");
      }
      const usuario = await dao.buscarSesion(digest(valor));
      if (!usuario) throw new ErrorAuth("sesion_vencida", "La sesión venció. Iniciá sesión nuevamente.");
      return usuario;
    },
  };
}

export = { crearAuthNegocio, ErrorAuth };
