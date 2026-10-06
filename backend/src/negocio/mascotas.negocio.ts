import crearMascotasDao = require("../dao/mascotas.dao");

class ErrorMascotas extends Error {
  constructor(public readonly motivo: "datos_invalidos" | "no_encontrada", mensaje: string) {
    super(mensaje);
  }
}

function validarId(valor: string) {
  const id = Number(valor);
  if (!/^\d+$/.test(valor) || !Number.isInteger(id) || id < 1 || id > 2147483647) {
    throw new ErrorMascotas("datos_invalidos", "El id debe ser un entero positivo válido");
  }
  return id;
}

function validarDatos(entrada: unknown) {
  const { nombre, especie, edad } = (entrada ?? {}) as {
    nombre?: unknown; especie?: unknown; edad?: unknown;
  };
  if (
    typeof nombre !== "string" || nombre.trim() === "" ||
    typeof especie !== "string" || especie.trim() === "" ||
    typeof edad !== "number" || !Number.isInteger(edad) || edad < 0 || edad > 2147483647
  ) {
    throw new ErrorMascotas("datos_invalidos", "Nombre y especie son obligatorios. Edad debe ser un número entero entre 0 y 2147483647.");
  }
  return { nombre: nombre.trim(), especie: especie.trim(), edad };
}

function crearMascotasNegocio(dao: ReturnType<typeof crearMascotasDao>) {
  return {
    listar(usuarioId: number) {
      return dao.listar(usuarioId);
    },
    crear(entrada: unknown, usuarioId: number) {
      return dao.crear(validarDatos(entrada), usuarioId);
    },
    async editar(valorId: string, entrada: unknown, usuarioId: number) {
      const id = validarId(valorId);
      const datos = validarDatos(entrada);
      const mascota = await dao.editar(id, datos, usuarioId);
      if (!mascota) throw new ErrorMascotas("no_encontrada", "Mascota no encontrada");
      return mascota;
    },
    async darDeBaja(valorId: string, usuarioId: number) {
      const id = validarId(valorId);
      if (!await dao.darDeBaja(id, usuarioId)) {
        throw new ErrorMascotas("no_encontrada", "Mascota no encontrada");
      }
    },
  };
}

export = { crearMascotasNegocio, ErrorMascotas };
