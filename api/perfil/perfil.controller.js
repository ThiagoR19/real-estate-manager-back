const service = require("./perfil.service")
const archivos = require("../../utils/archivos")
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

async function borrarArchivo(nombre) {
  if (!nombre) {
    return
  }
  try {
    await archivos.eliminar(service.CARPETA_FOTOS, nombre)
  } catch (error) {
    console.error(error)
  }
}

async function cambiarFoto(req, res, next) {
  const otrosCampos = Object.keys(req.files || {}).filter((campo) => campo !== "fotoPerfil")
  if (otrosCampos.length || Object.keys(req.body || {}).length) {
    return fallo(res, "DATOS_INVALIDOS", { mensaje: "Solo se admite el archivo fotoPerfil" })
  }
  if (Array.isArray(req.files?.fotoPerfil)) {
    return fallo(res, "DATOS_INVALIDOS", { mensaje: "Solo se admite una foto de perfil por petición" })
  }

  const guardado = await archivos(req.files?.fotoPerfil, service.CARPETA_FOTOS, ["imagen"])
  if (guardado.codigo !== "EXITO") {
    if (guardado.error) {
      console.error(guardado.error)
    }
    return fallo(res, guardado.codigo)
  }

  try {
    const resultado = await service.reemplazarFoto(req.usuario.id, guardado.nombre)
    if (!resultado) {
      await borrarArchivo(guardado.nombre)
      return fallo(res, "NO_ENCONTRADO", { mensaje: "El usuario no existe" })
    }
    await borrarArchivo(resultado.anterior)
    return exito(res, resultado.perfil)
  }
  catch (error) {
    await borrarArchivo(guardado.nombre)
    return next(error)
  }
}

async function quitarFoto(req, res, next) {
  try {
    const resultado = await service.reemplazarFoto(req.usuario.id, null)
    if (!resultado) {
      return fallo(res, "NO_ENCONTRADO", { mensaje: "El usuario no existe" })
    }
    if (!resultado.anterior) {
      return fallo(res, "NO_ENCONTRADO", { mensaje: "No tiene foto de perfil" })
    }
    await borrarArchivo(resultado.anterior)
    return exito(res, resultado.perfil)
  }
  catch (error) {
    return next(error)
  }
}

module.exports = { obtener, actualizar, cambiarContrasena, cambiarFoto, quitarFoto }
