const service = require("./auth.service")
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

async function activar(req, res, next) {
  try {
    const resultado = await service.activar(req.params.codigo, req.body)
    return exito(res, resultado)
  } catch (error) {
    return responderError(res, next, error)
  }
}

async function login(req, res, next) {
  try {
    const resultado = await service.login(req.body)
    return exito(res, resultado)
  } catch (error) {
    return responderError(res, next, error)
  }
}

module.exports = { activar, login }
