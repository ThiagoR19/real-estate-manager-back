const service = require("./profesionales.service")
const { crearProfesionalSchema, actualizarProfesionalSchema, idProfesionalSchema, profesionalQuerySchema, valorarProfesionalSchema } = require("./profesionales.schema")
const { exito, fallo, falloError } = require("../../utils/res")

async function listar(req, res) {
  const query = profesionalQuerySchema.parse(req.query)

  try {
    const resultado = await service.listar(req.usuario, query)
    return exito(res, resultado.items, { paginacion: resultado.paginacion })
  } catch (error) {
    return falloError(res, error)
  }
}

async function crear(req, res) {
  const cuerpo = crearProfesionalSchema.parse(req.body)

  try {
    const resultado = await service.crear(req.usuario, cuerpo)
    return exito(res, resultado, { http: 201 })
  } catch (error) {
    return falloError(res, error)
  }
}

async function actualizar(req, res) {
  const { id } = idProfesionalSchema.parse(req.params)
  const cuerpo = actualizarProfesionalSchema.parse(req.body)

  try {
    const resultado = await service.actualizar(req.usuario, id, cuerpo)
    return resultado ? exito(res, resultado) : fallo(res, "NO_ENCONTRADO")
  } catch (error) {
    return falloError(res, error)
  }
}

async function eliminar(req, res) {
  const { id } = idProfesionalSchema.parse(req.params)

  try {
    const eliminado = await service.eliminar(req.usuario, id)
    return eliminado ? exito(res, { id }) : fallo(res, "NO_ENCONTRADO")
  } catch (error) {
    return falloError(res, error)
  }
}

async function valorar(req, res) {
  const { id } = idProfesionalSchema.parse(req.params)
  const { puntuacion } = valorarProfesionalSchema.parse(req.body)

  try {
    return exito(res, await service.valorar(req.usuario, id, puntuacion), { http: 201 })
  } catch (error) {
    return falloError(res, error)
  }
}

module.exports = { listar, crear, actualizar, eliminar, valorar }
