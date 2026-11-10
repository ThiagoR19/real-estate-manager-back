const service = require("./propiedades.service")
const { crearPropiedadSchema, actualizarPropiedadSchema, idPropiedadSchema, propiedadesQuerySchema, } = require("./propiedades.schema")
const { exito, fallo } = require("../../utils/res")

async function catalogos(req, res, next) {
  try { return exito(res, await service.catalogos(req.usuario)) }
  catch (error) { next(error) }
}

async function listar(req, res) {
  const query = propiedadesQuerySchema.parse(req.query)

  try {
    const resultado = await service.listar(req.usuario, query)
    return exito(res, resultado.items, { paginacion: resultado.paginacion })
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

async function obtenerPorId(req, res) {
  const { id } = idPropiedadSchema.parse(req.params)

  try {
    const resultado = await service.buscarPorId(req.usuario, id)
    return resultado ? exito(res, resultado) : fallo(res, "NO_ENCONTRADO")
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

async function crear(req, res) {
  const cuerpo = crearPropiedadSchema.parse(req.body)

  try {
    const resultado = await service.crear(req.usuario, cuerpo)
    return exito(res, resultado, { http: 201 })
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

async function actualizar(req, res) {
  const { id } = idPropiedadSchema.parse(req.params)
  const cuerpo = actualizarPropiedadSchema.parse(req.body)

  try {
    const resultado = await service.actualizar(req.usuario, id, cuerpo)
    return resultado ? exito(res, resultado) : fallo(res, "NO_ENCONTRADO")
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

async function eliminar(req, res) {
  const { id } = idPropiedadSchema.parse(req.params)

  try {
    const eliminado = await service.eliminar(req.usuario, id)
    return eliminado ? exito(res, { id }) : fallo(res, "NO_ENCONTRADO")
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

module.exports = { catalogos, listar, obtenerPorId, crear, actualizar, eliminar }
