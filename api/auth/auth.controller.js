const service = require("./auth.service")
const { exito, fallo } = require("../../utils/res")

function manejar(accion) {
  return async (req, res, next) => {
    try {
      return exito(res, await accion(req))
    } catch (error) {
      if (error.codigo) {
        const opciones = error.message ? { mensaje: error.message } : {}
        return fallo(res, error.codigo, opciones)
      }
      return next(error)
    }
  }
}

const activar = manejar(async (req) => {
  return service.activar(req.params.codigo, req.body)
})

const login = manejar(async (req) => {
  return service.login(req.body)
})

module.exports = { activar, login }
