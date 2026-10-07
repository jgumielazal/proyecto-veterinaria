import crypto = require("node:crypto");
import crearAuthDao = require("../dao/auth.dao");

class ErrorAuth extends Error {
  constructor(public readonly motivo: "dni_registrado" | "no_encontrado" | "datos_invalidos" | "credenciales_invalidas" | "email_registrado" | "sesion_invalida" | "sesion_vencida", mensaje: string) {
    super(mensaje);
  }
}

function validarDni(dni: unknown): asserts dni is string {
  if (typeof dni !== "string" || dni.length !== 8 || !/^[0-9]{8}$/.test(dni)) {
    throw new ErrorAuth("datos_invalidos", "El DNI debe tener exactamente 8 dígitos, sin puntos ni espacios.");
  }
}
function duplicado(error: unknown) {
  if ((error as { constraint?: string }).constraint === "usuarios_dni_key") {
    throw new ErrorAuth("dni_registrado", "Ese DNI ya está registrado");
  }
  throw new ErrorAuth("email_registrado", "Ese email ya está registrado");
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
  async function crearDueno(entrada: unknown, nombre: string | null = null) {
    const { email, password, dni } = (entrada ?? {}) as Record<string, unknown>;
    validarDni(dni);
    if (typeof email !== "string" || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
        typeof password !== "string" || password.trim().length < 8 || password.length > 128) {
      throw new ErrorAuth("datos_invalidos", "Ingresá un email válido y una contraseña de entre 8 y 128 caracteres.");
    }
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = `${salt}:${(await derivar(password, salt)).toString("hex")}`;
    try { return await dao.crearUsuario(email.trim().toLowerCase(), hash, dni, "cliente", nombre); }
    catch (error) {
      if ((error as { code?: string }).code === "23505") duplicado(error);
      throw error;
    }
  }
  return {
    async crearDueno(entrada: unknown) {
      const { email, dni, nombre } = (entrada ?? {}) as Record<string, unknown>;
      if (typeof nombre !== "string" || nombre.trim().length > 150 || nombre.trim().split(/\s+/).length < 2) {
        throw new ErrorAuth("datos_invalidos", "Ingresá nombre y apellido (hasta 150 caracteres).");
      }
      // Alta administrativa sin contraseña elegida ni sesión del dueño.
      // Se descarta el secreto aleatorio; el acceso requiere definir una contraseña posteriormente.
      return crearDueno({ email, dni, password: crypto.randomBytes(32).toString("hex") }, nombre.trim());
    },
    async acceder(accion: "registro" | "login", entrada: unknown) {
      const { email, password, dni } = (entrada ?? {}) as { email?: unknown; password?: unknown; dni?: unknown };
      if (typeof email !== "string" || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
          typeof password !== "string" || password.trim().length < 8 || password.length > 128) {
        throw new ErrorAuth("datos_invalidos", "Ingresá un email válido y una contraseña de entre 8 y 128 caracteres.");
      }
      try {
        const normalizado = email.trim().toLowerCase();
        let usuario;
        if (accion === "registro") {
          usuario = await crearDueno({ email, password, dni });
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
          duplicado(error);
        }
        throw error;
      }
    },
    async crearVeterinario(entrada: unknown) {
      const { nombre, email, password, matricula, especialidad, dni } = (entrada ?? {}) as Record<string, unknown>;
      validarDni(dni);
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
        return await dao.crearVeterinario(nombre.trim(), email.trim().toLowerCase(), hash, matricula.trim(), especialidad.trim(), dni);
      } catch (error) {
        if ((error as { code?: string }).code === "23505") {
          duplicado(error);
        }
        throw error;
      }
    },
    async obtenerDueno(valor: string) {
      if (!/^[1-9]\d*$/.test(valor) || !Number.isSafeInteger(Number(valor)) || Number(valor) > 2147483647) {
        throw new ErrorAuth("datos_invalidos", "Identificador de dueño inválido");
      }
      const dueno = await dao.obtenerDueno(Number(valor));
      if (!dueno) throw new ErrorAuth("no_encontrado", "No se encontró el dueño");
      return dueno;
    },
    async listarDuenos() { return dao.listarDuenos(); },
    async listarVeterinarios() { return dao.listarVeterinarios(); },
    async gestionarVeterinario(accion: "ver" | "editar" | "baja", valor: string, entrada?: unknown) {
      if (!/^[1-9]\d*$/.test(valor) || !Number.isSafeInteger(Number(valor)) || Number(valor) > 2147483647) {
        throw new ErrorAuth("datos_invalidos", "Identificador de veterinario inválido");
      }
      const id = Number(valor);
      let veterinario;
      try {
        if (accion === "editar") {
          const { nombre, email, matricula, especialidad, dni } = (entrada ?? {}) as Record<string, unknown>;
          validarDni(dni);
          if (typeof nombre !== "string" || !nombre.trim() || nombre.trim().length > 150 ||
              typeof email !== "string" || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
              typeof matricula !== "string" || !matricula.trim() || matricula.trim().length > 80 ||
              typeof especialidad !== "string" || !especialidad.trim() || especialidad.trim().length > 150) {
            throw new ErrorAuth("datos_invalidos", "Completá nombre, email válido, matrícula y especialidad dentro de los límites permitidos.");
          }
          veterinario = await dao.editarVeterinario(id, nombre.trim(), email.trim().toLowerCase(), matricula.trim(), especialidad.trim(), dni);
        } else veterinario = accion === "baja" ? await dao.bajaVeterinario(id) : await dao.obtenerVeterinario(id);
      } catch (error) {
        if ((error as { code?: string }).code === "23505") duplicado(error);
        throw error;
      }
      if (!veterinario) throw new ErrorAuth("no_encontrado", "No se encontró el veterinario");
      return veterinario;
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
