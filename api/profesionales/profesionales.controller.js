const service = require("./profesionales.service")
const {
  crearProfesionalSchema,
  actualizarProfesionalSchema,
  idProfesionalSchema,
  profesionalQuerySchema,
} = require("./profesionales.schema")
const { exito, fallo } = require("../../utils/res")

async function listar(req, res) {
  const query = profesionalQuerySchema.parse(req.query)

  try {
    const resultado = await service.listar(req.usuario, query)
    return exito(res, resultado.items, { paginacion: resultado.paginacion })
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

async function crear(req, res) {
  const cuerpo = crearProfesionalSchema.parse(req.body)

  try {
    const resultado = await service.crear(req.usuario, cuerpo)
    return exito(res, resultado, { http: 201 })
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

async function actualizar(req, res) {
  const { id } = idProfesionalSchema.parse(req.params)
  const cuerpo = actualizarProfesionalSchema.parse(req.body)

  try {
    const resultado = await service.actualizar(req.usuario, id, cuerpo)
    return exito(res, resultado)
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

async function eliminar(req, res) {
  const { id } = idProfesionalSchema.parse(req.params)

  try {
    await service.eliminar(req.usuario, id)
    return exito(res, { id })
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

module.exports = { listar, crear, actualizar, eliminar }
