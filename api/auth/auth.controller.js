const service = require("./auth.service")
const { exito, fallo } = require("../../utils/res")

async function activar(req, res) {
  try {
    const resultado = await service.activar(req.params.codigo, req.body)
    return exito(res, resultado)
  } catch (error) {
    if (error.codigo) {
      const opciones = error.message ? { mensaje: error.message } : {}
      return fallo(res, error.codigo, opciones)
    }
    return fallo(res, "ERROR_INTERNO")
  }
}

async function login(req, res) {
  try {
    const resultado = await service.login(req.body)
    return exito(res, resultado)
  } catch (error) {
    if (error.codigo) {
      const opciones = error.message ? { mensaje: error.message } : {}
      return fallo(res, error.codigo, opciones)
    }
    return fallo(res, "ERROR_INTERNO")
  }
}

module.exports = { activar, login }
