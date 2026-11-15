const service = require("./notificaciones.service")
const { idNotificacionSchema } = require("./notificaciones.schema")
const { exito, fallo, falloError } = require("../../utils/res")

async function listar(req, res) {
  try {
    const resultado = await service.listar(req.usuario, req.usuario.idInmobi)
    return exito(res, resultado)
  } catch (error) {
    return falloError(res, error)
  }
}

async function actualizar(req, res) {
  const { id } = idNotificacionSchema.parse(req.params)

  try {
    const resultado = await service.actualizar(req.usuario, id, req.usuario.idInmobi)
    return resultado ? exito(res, resultado) : fallo(res, "NO_ENCONTRADO")
  } catch (error) {
    return falloError(res, error)
  }
}


module.exports = { listar, actualizar }
