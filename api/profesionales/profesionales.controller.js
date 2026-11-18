const service = require("./profesionales.service")
const { crearProfesionalSchema, actualizarProfesionalSchema, idProfesionalSchema, profesionalQuerySchema, valorarProfesionalSchema } = require("./profesionales.schema")
const { exito, fallo } = require("../../utils/res")

async function listar(req, res) {
  const query = profesionalQuerySchema.parse(req.query)

  const resultado = await service.listar(req.usuario, query)
  return exito(res, resultado.items, { paginacion: resultado.paginacion })
}

async function crear(req, res) {
  const cuerpo = crearProfesionalSchema.parse(req.body)

  const resultado = await service.crear(req.usuario, cuerpo)
  return exito(res, resultado, { http: 201 })
}

async function actualizar(req, res) {
  const { id } = idProfesionalSchema.parse(req.params)
  const cuerpo = actualizarProfesionalSchema.parse(req.body)

  const resultado = await service.actualizar(req.usuario, id, cuerpo)
  return resultado ? exito(res, resultado) : fallo(res, "NO_ENCONTRADO")
}

async function eliminar(req, res) {
  const { id } = idProfesionalSchema.parse(req.params)

  const eliminado = await service.eliminar(req.usuario, id)
  return eliminado ? exito(res, { id }) : fallo(res, "NO_ENCONTRADO")
}

async function valorar(req, res) {
  const { id } = idProfesionalSchema.parse(req.params)
  const { puntuacion } = valorarProfesionalSchema.parse(req.body)

  return exito(res, await service.valorar(req.usuario, id, puntuacion), { http: 201 })
}

module.exports = { listar, crear, actualizar, eliminar, valorar }
