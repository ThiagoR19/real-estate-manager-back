const bcrypt = require("bcrypt")
const repository = require("./inquilinos.repository")
const AppError = require("../../utils/app-error")
const {
  validarCrear,
  validarActualizar,
  validarId,
  validarListado,
} = require("./inquilinos.validation")

const SALT_ROUNDS = Number(process.env.SALT_ROUNDS) || 10

function obtenerIdInmobiliaria(usuario) {
  const idInmobiliaria = Number(usuario && usuario.idInmobi)

  if (!Number.isInteger(idInmobiliaria) || idInmobiliaria <= 0) {
    throw new AppError(
      "DATOS_INVALIDOS",
      "La sesión no tiene una inmobiliaria válida asociada"
    )
  }

  return idInmobiliaria
}

function traducirError(error) {
  if (error instanceof AppError) return error

  if (error.code === "ER_DUP_ENTRY") {
    const mensaje = String(error.sqlMessage || error.message || "")

    if (mensaje.includes("Usuario")) {
      return new AppError("CONFLICTO", "El nombre de usuario ya está en uso")
    }

    return new AppError("CONFLICTO", "Ya existe un registro con alguno de los datos enviados")
  }

  if (error.code === "ER_ROW_IS_REFERENCED_2" || error.code === "ER_ROW_IS_REFERENCED") {
    return new AppError(
      "CONFLICTO",
      "No se puede eliminar el inquilino porque tiene información relacionada"
    )
  }

  if (error.code === "ER_NO_REFERENCED_ROW_2" || error.code === "ER_NO_REFERENCED_ROW") {
    return new AppError("DATOS_INVALIDOS", "La inmobiliaria indicada no existe")
  }

  return error
}

async function listar(usuario, query) {
  const idInmobiliaria = obtenerIdInmobiliaria(usuario)
  const filtros = validarListado(query)

  try {
    const [items, total] = await Promise.all([
      repository.listar({ idInmobiliaria, ...filtros }),
      repository.contar({ idInmobiliaria, ...filtros }),
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

async function buscarPorId(usuario, valorId) {
  const idInmobiliaria = obtenerIdInmobiliaria(usuario)
  const id = validarId(valorId)

  try {
    const inquilino = await repository.buscarPorId(id, idInmobiliaria)

    if (!inquilino) {
      throw new AppError("NO_ENCONTRADO", "El inquilino no existe")
    }

    return inquilino
  } catch (error) {
    throw traducirError(error)
  }
}

async function crear(usuario, cuerpo) {
  const idInmobiliaria = obtenerIdInmobiliaria(usuario)
  const datos = validarCrear(cuerpo)
  datos.idInmobiliaria = idInmobiliaria
  datos.password = await bcrypt.hash(datos.password, SALT_ROUNDS)

  try {
    const id = await repository.crear(datos)
    return repository.buscarPorId(id, idInmobiliaria)
  } catch (error) {
    throw traducirError(error)
  }
}

async function actualizar(usuario, valorId, cuerpo) {
  const idInmobiliaria = obtenerIdInmobiliaria(usuario)
  const id = validarId(valorId)
  const datos = validarActualizar(cuerpo)

  if (datos.password !== undefined) {
    datos.password = await bcrypt.hash(datos.password, SALT_ROUNDS)
  }

  try {
    const actualizado = await repository.actualizar(id, idInmobiliaria, datos)

    if (!actualizado) {
      throw new AppError("NO_ENCONTRADO", "El inquilino no existe")
    }

    return repository.buscarPorId(id, idInmobiliaria)
  } catch (error) {
    throw traducirError(error)
  }
}

async function eliminar(usuario, valorId) {
  const idInmobiliaria = obtenerIdInmobiliaria(usuario)
  const id = validarId(valorId)

  try {
    const eliminado = await repository.eliminar(id, idInmobiliaria)

    if (!eliminado) {
      throw new AppError("NO_ENCONTRADO", "El inquilino no existe")
    }
  } catch (error) {
    throw traducirError(error)
  }
}

module.exports = {
  listar,
  buscarPorId,
  crear,
  actualizar,
  eliminar,
}
