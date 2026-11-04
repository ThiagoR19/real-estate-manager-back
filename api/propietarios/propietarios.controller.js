const service = require("./propietarios.service")
const {
  crearPropietarioSchema,
  actualizarPropietarioSchema,
  idPropietarioSchema,
  propietariosQuerySchema,
} = require("./propietarios.schema")
const { exito, fallo } = require("../../utils/res")

async function listar(req, res) {
  const query = propietariosQuerySchema.parse(req.query)

  try {
    const resultado = await service.listar(req.usuario, query)
    return exito(res, resultado.items, { paginacion: resultado.paginacion })
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

async function crear(req, res) {
  const cuerpo = crearPropietarioSchema.parse(req.body)

  try {
    const resultado = await service.crear(req.usuario, cuerpo)
    return exito(res, resultado, { http: 201 })
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

async function actualizar(req, res) {
  const { id } = idPropietarioSchema.parse(req.params)
  const cuerpo = actualizarPropietarioSchema.parse(req.body)

  try {
    const resultado = await service.actualizar(req.usuario, id, cuerpo)
    return exito(res, resultado)
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

async function eliminar(req, res) {
  const { id } = idPropietarioSchema.parse(req.params)

  try {
    await service.eliminar(req.usuario, id)
    return exito(res, { id })
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

module.exports = { listar, crear, actualizar, eliminar }
