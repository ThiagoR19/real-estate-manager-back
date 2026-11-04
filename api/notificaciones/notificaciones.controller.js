const service = require("./notificaciones.service")
const { exito, fallo } = require("../../utils/res")

async function listar(req, res) {
  try {
    const resultado = await service.listar(req.usuario, req.usuario.idInmobi)
    return exito(res, resultado)
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

async function actualizar(req, res) {
  try {
    const resultado = await service.actualizar(req.usuario, req.params.id, req.usuario.idInmobi)
    return exito(res, resultado)
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}


module.exports = { listar, actualizar }
