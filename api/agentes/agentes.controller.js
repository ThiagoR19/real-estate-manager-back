const service = require("./agentes.service")
const { crearAgenteSchema, actualizarAgenteSchema, idAgenteSchema, rolAgenteSchema, agentesQuerySchema } = require("./agentes.schema")
const { exito, fallo } = require("../../utils/res")

async function listar(req, res) {
  const query = agentesQuerySchema.parse(req.query)

  try {
    const resultado = await service.listar(req.usuario, query)
    return exito(res, resultado.items, { paginacion: resultado.paginacion })
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

async function obtener(req, res) {
  const { id } = idAgenteSchema.parse(req.params)

  try {
    const resultado = await service.buscarPorId(req.usuario, id)
    return exito(res, resultado)
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

async function crear(req, res) {
  const cuerpo = crearAgenteSchema.parse(req.body)

  try {
    const resultado = await service.crear(req.usuario, cuerpo)
    return exito(res, resultado, { http: 201 })
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return fallo(res, "CONFLICTO", { mensaje: "Ese DNI ya está registrado en la inmobiliaria" })
    return fallo(res, "ERROR_INTERNO")
  }
}

async function actualizar(req, res) {
  const { id } = idAgenteSchema.parse(req.params)
  const cuerpo = actualizarAgenteSchema.parse(req.body)

  try {
    const resultado = await service.actualizar(req.usuario, id, cuerpo)
    return exito(res, resultado)
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

async function cambiarRol(req, res) {
  // Cada esquema es estricto: se le pasa solo su parámetro
  const { id } = idAgenteSchema.parse({ id: req.params.id })
  const { rol } = rolAgenteSchema.parse({ rol: req.params.rol })

  try {
    const resultado = await service.cambiarRol(req.usuario, id, rol)
    if (!resultado.afectados) {
      return fallo(res, "NO_ENCONTRADO", { mensaje: "El agente no existe" })
    }
    return exito(res, resultado)
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

async function eliminar(req, res) {
  const { id } = idAgenteSchema.parse(req.params)

  try {
    const eliminado = await service.eliminar(req.usuario, id)
    if (!eliminado) {
      return fallo(res, "NO_ENCONTRADO", { mensaje: "El agente no existe" })
    }
    return exito(res, { id })
  } catch (error) {
    if (error.code === "ER_ROW_IS_REFERENCED_2") {
      return fallo(res, "CONFLICTO", { mensaje: "No se puede eliminar: la persona figura en contratos, pagos u otros registros" })
    }
    return fallo(res, "ERROR_INTERNO")
  }
}

async function listarArchivos(req, res, next) {
  try { return exito(res, await service.listarArchivos(req.entidadArchivos)) }
  catch (error) { next(error) }
}

async function cargarFoto(req, res, next) {
  try { return exito(res, await service.cargarFoto(req.entidadArchivos, req.archivos)) }
  catch (error) { return error.codigo ? fallo(res, error.codigo) : next(error) }
}

async function eliminarFoto(req, res, next) {
  try {
    await service.eliminarFoto(req.entidadArchivos)
    return exito(res, null)
  } catch (error) { return error.codigo ? fallo(res, error.codigo) : next(error) }
}

module.exports = { listar, obtener, crear, actualizar, cambiarRol, eliminar , listarArchivos, cargarFoto, eliminarFoto}
