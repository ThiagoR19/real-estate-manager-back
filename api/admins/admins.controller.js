 const service = require("./admins.service")
const { adminsQuerySchema, crearAdminSchema, idAdminSchema } = require("./admins.schema")
const { exito, fallo } = require("../../utils/res")

async function listar(req, res) {
  const query = adminsQuerySchema.parse(req.query)

  const resultado = await service.listar(query)
  return exito(res, resultado.items, { paginacion: resultado.paginacion })
}

async function crear(req, res) {
  const cuerpo = crearAdminSchema.parse(req.body)

  const resultado = await service.crear(cuerpo)
  return exito(res, resultado, { http: 201 })
}

async function generarEnlaceActivacion(req, res) {
  const { id } = idAdminSchema.parse(req.params)

  const resultado = await service.generarEnlaceActivacion(id)
  if (resultado.error) return fallo(res, resultado.error)
  return exito(res, { activacion: resultado })
}

async function eliminar(req, res) {
  const { id } = idAdminSchema.parse(req.params)

  const eliminado = await service.eliminar(id)
  if (!eliminado) {
    return fallo(res, "NO_ENCONTRADO", { mensaje: "El administrador no existe" })
  }
  return exito(res, { id })
}

async function pasarAAgente(req, res) {
  const { id } = idAdminSchema.parse(req.params)

  const resultado = await service.pasarAAgente(id)
  if (!resultado) {
    return fallo(res, "NO_ENCONTRADO", { mensaje: "El administrador no existe" })
  }
  return exito(res, resultado)
}

async function listarArchivos(req, res, next) {
  try { return exito(res, await service.listarArchivos(req.entidadArchivos)) }
  catch (error) { next(error) }
}

async function cargarFoto(req, res, next) {
  try { return exito(res, await service.cargarFoto(req.entidadArchivos, req.archivos)) }
  catch (error) { return error.codigo ? fallo(res, error.codigo, { mensaje: error.message, detalles: error.detalles }) : next(error) }
}

async function eliminarFoto(req, res, next) {
  try {
    await service.eliminarFoto(req.entidadArchivos)
    return exito(res, null)
  } catch (error) { return error.codigo ? fallo(res, error.codigo, { mensaje: error.message, detalles: error.detalles }) : next(error) }
}

module.exports = { listar, crear, generarEnlaceActivacion, eliminar, pasarAAgente, listarArchivos, cargarFoto, eliminarFoto}
