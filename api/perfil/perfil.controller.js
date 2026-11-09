const service = require("./perfil.service")
const { actualizarPerfilSchema } = require("./perfil.schema")
const { exito, fallo } = require("../../utils/res")

async function obtener(req, res) {
  try {
    const resultado = await service.obtener(req.usuario.id)
    if (!resultado) return fallo(res, "NO_ENCONTRADO")
    return exito(res, resultado)
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

async function actualizar(req, res) {
  const cuerpo = actualizarPerfilSchema.parse(req.body)

  try {
    const resultado = await service.actualizar(req.usuario.id, cuerpo)
    if (!resultado) return fallo(res, "NO_ENCONTRADO")
    return exito(res, resultado)
  } catch (error) {
    if (error.codigo) {
      const opciones = error.message ? { mensaje: error.message } : {}
      return fallo(res, error.codigo, opciones)
    }
    return fallo(res, "ERROR_INTERNO")
  }
}

module.exports = { obtener, actualizar }
