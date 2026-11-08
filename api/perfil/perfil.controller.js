const service = require("./perfil.service")
const { exito, fallo } = require("../../utils/res")
const { crearTokenS } = require("../../utils/token")
const { actualizarPerfilSchema, cambiarContrasenaSchema } = require("./perfil.schema")

async function obtener(req, res, next) {
  try {
    const perfil = await service.obtener(req.usuario.id)
    if (!perfil) {
      return fallo(res, "NO_ENCONTRADO", { mensaje: "El usuario no existe" })
    }
    return exito(res, perfil)
  }
  catch (error) {
    return next(error)
  }
}

async function actualizar(req, res, next) {
  const cambios = actualizarPerfilSchema.parse(req.body)

  try {
    const resultado = await service.actualizar(req.usuario.id, cambios)
    if (resultado.error) {
      return fallo(res, resultado.error, { mensaje: resultado.mensaje, detalles: resultado.detalles })
    }

    const { perfil } = resultado
    const token = crearTokenS(perfil.nombre, perfil.apellido, perfil.idRol, perfil.id, perfil.idInmobiliaria)
    return exito(res, { perfil, token })
  }
  catch (error) {
    return next(error)
  }
}

async function cambiarContrasena(req, res, next) {
  const cuerpo = cambiarContrasenaSchema.parse(req.body)

  try {
    const resultado = await service.cambiarContrasena(req.usuario.id, cuerpo)
    if (resultado.error) {
      return fallo(res, resultado.error, { mensaje: resultado.mensaje, detalles: resultado.detalles })
    }
    return exito(res, null)
  }
  catch (error) {
    return next(error)
  }
}

module.exports = { obtener, actualizar, cambiarContrasena }
