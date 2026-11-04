const service = require("./inquilinos.service")
const { exito, fallo } = require("../../utils/res")

async function listar(req, res) {
  try {
    const resultado = await service.listar(req.usuario, req.query)
    return exito(res, resultado.items, { paginacion: resultado.paginacion })
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

async function obtener(req, res) {
  try {
    const resultado = await service.buscarPorId(req.usuario, req.params.id)
    return exito(res, resultado)
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

async function crear(req, res) {
  try {
    const resultado = await service.crear(req.usuario, req.body)
    return exito(res, resultado, { http: 201 })
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

async function actualizar(req, res) {
  try {
    const resultado = await service.actualizar(req.usuario, req.params.id, req.body)
    return exito(res, resultado)
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

async function eliminar(req, res) {
  try {
    await service.eliminar(req.usuario, req.params.id)
    return exito(res, { id: req.params.id })
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

module.exports = { listar, obtener, crear, actualizar, eliminar }
