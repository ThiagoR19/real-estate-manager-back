 const service = require("./admins.service")
const { adminsQuerySchema, crearAdminSchema, idAdminSchema } = require("./admins.schema")
const { exito, fallo } = require("../../utils/res")

async function listar(req, res) {
  const query = adminsQuerySchema.parse(req.query)

  try {
    const resultado = await service.listar(query)
    return exito(res, resultado.items, { paginacion: resultado.paginacion })
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

async function crear(req, res) {
  const cuerpo = crearAdminSchema.parse(req.body)

  try {
    const resultado = await service.crear(cuerpo)
    return exito(res, resultado, { http: 201 })
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

async function eliminar(req, res) {
  const { id } = idAdminSchema.parse(req.params)

  try {
    await service.eliminar(id)
    return exito(res, { id })
  } catch (error) {
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

module.exports = { listar, crear, eliminar , listarArchivos, cargarFoto, eliminarFoto}
