const service = require("./inquilinos.service")
const { exito, fallo } = require("../../utils/res")
const AppError = require("../../utils/app-error")

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
    const resultado = await service.listar(req.usuario, req.query)
    return exito(res, resultado.items, { paginacion: resultado.paginacion })
  } catch (error) {
    return responderError(res, next, error)
  }
}

async function obtener(req, res, next) {
  try {
    const inquilino = await service.buscarPorId(req.usuario, req.params.id)
    return exito(res, inquilino)
  } catch (error) {
    return responderError(res, next, error)
  }
}

async function crear(req, res, next) {
  try {
    const inquilino = await service.crear(req.usuario, req.body)
    return exito(res, inquilino, { http: 201 })
  } catch (error) {
    return responderError(res, next, error)
  }
}

async function actualizar(req, res, next) {
  try {
    const inquilino = await service.actualizar(req.usuario, req.params.id, req.body)
    return exito(res, inquilino)
  } catch (error) {
    return responderError(res, next, error)
  }
}

async function eliminar(req, res, next) {
  try {
    await service.eliminar(req.usuario, req.params.id)
    return exito(res, { id: Number(req.params.id) })
  } catch (error) {
    return responderError(res, next, error)
  }
}

module.exports = {
  listar,
  obtener,
  crear,
  actualizar,
  eliminar,
}
