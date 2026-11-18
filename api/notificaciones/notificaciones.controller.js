const service = require("./notificaciones.service")
const { idNotificacionSchema } = require("./notificaciones.schema")
const { exito, fallo } = require("../../utils/res")

async function listar(req, res) {
  const resultado = await service.listar(req.usuario, req.usuario.idInmobi)
  return exito(res, resultado)
}

async function actualizar(req, res) {
  const { id } = idNotificacionSchema.parse(req.params)

  const resultado = await service.actualizar(req.usuario, id, req.usuario.idInmobi)
  return resultado ? exito(res, resultado) : fallo(res, "NO_ENCONTRADO")
}


module.exports = { listar, actualizar }
