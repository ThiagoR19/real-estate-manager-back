const service = require("./propiedades.service")
const { exito, fallo } = require("../../utils/res")

async function listar(req, res) {
  try {
    const resultado = await service.listar(req.usuario, req.body)
    return exito(res, resultado.items, { paginacion: resultado.paginacion })
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

async function crear(req, res) {
  try {
    const resultado = await service.crear(req.usuario, req.body)
    return exito(res, resultado.items, { http: 201 })
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

async function actualizar(req, res) {
  try {
    const resultado = await service.actualizar(req.usuario, req.id, req.body)
    return exito(res, resultado.items, { http: 201 })
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

async function eliminar(req, res) {
  try {
    const resultado = await service.eliminar(req.usuario, req.id, req.body)
    return exito(res, resultado.items, { http: 201 })
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

module.exports = { listar, crear, actualizar, eliminar }
