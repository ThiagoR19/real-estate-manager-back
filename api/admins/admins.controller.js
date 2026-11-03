const service = require("./admins.service")
const AppError = require("../../utils/app-error")
const { exito, fallo } = require("../../utils/res")

function responderError(res, next, error) {
  if (error instanceof AppError) {
    return fallo(res, error.codigo, {
      mensaje: error.message,
      detalles: error.detalles,
    })
  }

  return next(error)
}

async function listar(req, res, next) {
  try {
    const resultado = await service.listar(req.query)
    return exito(res, resultado.items, { paginacion: resultado.paginacion })
  } catch (error) {
    return responderError(res, next, error)
  }
}

async function crear(req, res, next) {
  try {
    return exito(res, await service.crear(req.body), { http: 201 })
  } catch (error) {
    return responderError(res, next, error)
  }
}

async function eliminar(req, res, next) {
  try {
    await service.eliminar(req.params.id)
    return exito(res, { id: Number(req.params.id) })
  } catch (error) {
    return responderError(res, next, error)
  }
}

module.exports = { listar, crear, eliminar }
