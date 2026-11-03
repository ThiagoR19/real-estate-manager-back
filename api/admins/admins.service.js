const bcrypt = require("bcrypt")
const repository = require("./admins.repository")
const AppError = require("../../utils/app-error")
const { crearEnlaceActivacion } = require("../../utils/activacion")
const {
  validarCrearCuenta,
  validarIdRecurso,
  validarListado,
} = require("../../utils/cuenta-validation")

const SALT_ROUNDS = Number(process.env.SALT_ROUNDS) || 10

function traducirError(error) {
  if (error instanceof AppError) return error

  if (error.code === "ER_DUP_ENTRY") {
    const mensaje = String(error.sqlMessage || error.message || "")

    if (mensaje.includes("Usuario")) {
      return new AppError("CONFLICTO", "El nombre de usuario ya está en uso")
    }

    return new AppError("CONFLICTO", "Ya existe un registro con alguno de los datos enviados")
  }

  if (error.code === "ER_NO_REFERENCED_ROW_2" || error.code === "ER_NO_REFERENCED_ROW") {
    return new AppError("DATOS_INVALIDOS", "La inmobiliaria indicada no existe")
  }

  return error
}

async function listar(query) {
  const filtros = validarListado(query)

  try {
    const [items, total] = await Promise.all([
      repository.listar(filtros),
      repository.contar(filtros),
    ])

    return {
      items,
      paginacion: {
        pagina: filtros.pagina,
        limite: filtros.limite,
        total,
        paginas: Math.ceil(total / filtros.limite),
      },
    }
  } catch (error) {
    throw traducirError(error)
  }
}

async function crear(cuerpo) {
  const datos = validarCrearCuenta(cuerpo, { inmobiliariaObligatoria: true })
  datos.password = await bcrypt.hash(datos.password, SALT_ROUNDS)

  try {
    const cuenta = await repository.crear(datos)
    const admin = await repository.buscarPorId(cuenta.id)

    return {
      ...admin,
      activacion: {
        codigo: cuenta.codigoActivacion,
        enlace: crearEnlaceActivacion(cuenta.codigoActivacion),
        expiraEn: cuenta.fechaExpiracion.toISOString(),
      },
    }
  } catch (error) {
    throw traducirError(error)
  }
}

async function eliminar(valorId) {
  const id = validarIdRecurso(valorId, "id")

  try {
    const eliminado = await repository.eliminar(id)

    if (!eliminado) {
      throw new AppError("NO_ENCONTRADO", "El administrador no existe")
    }
  } catch (error) {
    throw traducirError(error)
  }
}

module.exports = { listar, crear, eliminar }
