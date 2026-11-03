const bcrypt = require("bcrypt")
const repository = require("./agentes.repository")
const AppError = require("../../utils/app-error")
const { crearEnlaceActivacion } = require("../../utils/activacion")
const { SUPERADMIN, ADMIN, AGENTE } = require("../../config/roles")
const {
  validarCrearCuenta,
  validarActualizarCuenta,
  validarIdRecurso,
  validarListado,
} = require("../../utils/cuenta-validation")

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

function obtenerAlcance(usuario, valor) {
  if (usuario.rol === SUPERADMIN) {
    if (valor === undefined || valor === null || valor === "") return null
    return validarIdRecurso(valor, "idInmobiliaria")
  }

  return obtenerIdInmobiliaria(usuario)
}

function validarRol(valor) {
  const roles = {
    [String(ADMIN)]: ADMIN,
    [String(AGENTE)]: AGENTE,
    ADMIN,
    AGENTE,
  }
  const rol = roles[String(valor).toUpperCase()]

  if (!rol) {
    throw new AppError("DATOS_INVALIDOS", "El rol debe ser ADMIN o AGENTE")
  }

  return rol
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

  if (error.code === "ER_NO_REFERENCED_ROW_2" || error.code === "ER_NO_REFERENCED_ROW") {
    return new AppError("DATOS_INVALIDOS", "La inmobiliaria o el área indicada no existe")
  }

  return error
}

async function listar(usuario, query) {
  const filtros = validarListado(query)
  const idInmobiliaria = obtenerAlcance(usuario, query.idInmobiliaria)

  try {
    const parametros = { ...filtros, idInmobiliaria }
    const [items, total] = await Promise.all([
      repository.listar(parametros),
      repository.contar(parametros),
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
  const id = validarIdRecurso(valorId, "id")
  const idInmobiliaria = obtenerAlcance(usuario)

  try {
    const agente = await repository.buscarPorId(id, idInmobiliaria)

    if (!agente) throw new AppError("NO_ENCONTRADO", "El agente no existe")
    return agente
  } catch (error) {
    throw traducirError(error)
  }
}

async function crear(usuario, cuerpo) {
  const datos = validarCrearCuenta(cuerpo)
  datos.idInmobiliaria = usuario.rol === SUPERADMIN
    ? validarIdRecurso(datos.idInmobiliaria, "idInmobiliaria")
    : obtenerIdInmobiliaria(usuario)

  if (Object.prototype.hasOwnProperty.call(cuerpo, "idArea")) {
    datos.idArea = cuerpo.idArea === null || cuerpo.idArea === ""
      ? null
      : validarIdRecurso(cuerpo.idArea, "idArea")
  } else {
    datos.idArea = null
  }

  datos.password = await bcrypt.hash(datos.password, SALT_ROUNDS)

  try {
    const cuenta = await repository.crear(datos)
    const agente = await repository.buscarPorId(cuenta.id, datos.idInmobiliaria)

    return {
      ...agente,
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

async function actualizar(usuario, valorId, cuerpo) {
  const id = validarIdRecurso(valorId, "id")
  const idInmobiliaria = obtenerAlcance(usuario)
  const datos = validarActualizarCuenta(cuerpo, { permiteArea: true })

  if (datos.password !== undefined) {
    datos.password = await bcrypt.hash(datos.password, SALT_ROUNDS)
  }

  try {
    const actualizado = await repository.actualizar(id, idInmobiliaria, datos)

    if (!actualizado) throw new AppError("NO_ENCONTRADO", "El agente no existe")
    return repository.buscarPorId(id, idInmobiliaria)
  } catch (error) {
    throw traducirError(error)
  }
}

async function cambiarRol(usuario, valorId, valorRol) {
  const id = validarIdRecurso(valorId, "id")
  const rol = validarRol(valorRol)
  const idInmobiliaria = obtenerAlcance(usuario)

  try {
    const actualizado = await repository.cambiarRol(id, rol, idInmobiliaria)

    if (!actualizado) throw new AppError("NO_ENCONTRADO", "El agente no existe")
    return { id, rol }
  } catch (error) {
    throw traducirError(error)
  }
}

async function eliminar(usuario, valorId) {
  const id = validarIdRecurso(valorId, "id")
  const idInmobiliaria = obtenerAlcance(usuario)

  try {
    const eliminado = await repository.eliminar(id, idInmobiliaria)

    if (!eliminado) throw new AppError("NO_ENCONTRADO", "El agente no existe")
  } catch (error) {
    throw traducirError(error)
  }
}

module.exports = {
  listar,
  buscarPorId,
  crear,
  actualizar,
  cambiarRol,
  eliminar,
}
