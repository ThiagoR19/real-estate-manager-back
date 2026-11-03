const service = require("./auth.service")
const { exito, fallo } = require("../../utils/res")

async function activar(req, res, next) {
  try {
    const resultado = await service.activar(req.params.codigo, req.body)
    return exito(res, resultado)
  } catch (error) {
    return fallo(res, next, error)
  }
}

async function login(req, res, next) {
  try {
    const resultado = await service.login(req.body)
    return exito(res, resultado)
  } catch (error) {
    return fallo(res, next, error)
  }
}

module.exports = { activar, login }
