const service = require("./agentes.service")
const { crearAgenteSchema, actualizarAgenteSchema, idAgenteSchema, rolAgenteSchema, agentesQuerySchema } = require("./agentes.schema")
const { exito, fallo } = require("../../utils/res")

async function listar(req, res) {
  const query = agentesQuerySchema.parse(req.query)

  const resultado = await service.listar(req.usuario, query)
  return exito(res, resultado.items, { paginacion: resultado.paginacion })
}

async function obtener(req, res) {
  const { id } = idAgenteSchema.parse(req.params)

  const resultado = await service.buscarPorId(req.usuario, id)
  return resultado ? exito(res, resultado) : fallo(res, "NO_ENCONTRADO")
}

async function crear(req, res) {
  const cuerpo = crearAgenteSchema.parse(req.body)

  const resultado = await service.crear(req.usuario, cuerpo)
  return exito(res, resultado, { http: 201 })
}

async function generarEnlaceActivacion(req, res) {
  const { id } = idAgenteSchema.parse(req.params)
  const resultado = await service.generarEnlaceActivacion(req.usuario, id)
  if (resultado.error) return fallo(res, resultado.error)
  return exito(res, { activacion: resultado })
}

async function actualizar(req, res) {
  const { id } = idAgenteSchema.parse(req.params)
  const cuerpo = actualizarAgenteSchema.parse(req.body)

  const resultado = await service.actualizar(req.usuario, id, cuerpo)
  return resultado ? exito(res, resultado) : fallo(res, "NO_ENCONTRADO")
}

async function cambiarRol(req, res) {

  const { id } = idAgenteSchema.parse({ id: req.params.id })
  const { rol } = rolAgenteSchema.parse({ rol: req.params.rol })

  const resultado = await service.cambiarRol(req.usuario, id, rol)
  if (!resultado.afectados) {
    return fallo(res, "NO_ENCONTRADO", { mensaje: "El agente no existe" })
  }
  return exito(res, resultado)
}

async function eliminar(req, res) {
  const { id } = idAgenteSchema.parse(req.params)

  const eliminado = await service.eliminar(req.usuario, id)
  if (!eliminado) {
    return fallo(res, "NO_ENCONTRADO", { mensaje: "El agente no existe" })
  }
  return exito(res, { id })
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

module.exports = { listar, obtener, crear, generarEnlaceActivacion, actualizar, cambiarRol, eliminar , listarArchivos, cargarFoto, eliminarFoto}
