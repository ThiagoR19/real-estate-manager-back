const service = require("./inmobiliarias.service")
const { exito, fallo } = require("../../utils/res")
const archivos = require("../../utils/archivos")
const { limpiar } = require("../../utils/adjuntos")

const { crearInmobiliariaSchema, editarInmobiliariaSchema, cambiarNombreSchema, idInmobiliariaSchema, inmobiliariasQuerySchema } = require("./inmobiliarias.schema")

async function listar(req, res, next) {
  const query = inmobiliariasQuerySchema.parse(req.query)

  try {
    const resultado = await service.listar(query)
    return exito(res, resultado.items, { paginacion: resultado.paginacion })
  }
  catch (error) {
    return next(error)
  }
}

async function crear(req, res, next) {
  const { nombre } = crearInmobiliariaSchema.parse(req.body)

  try {
    const inmobiliaria = await service.crear(nombre)
    return exito(res, inmobiliaria, { http: 201 })
  }
  catch (error) {
    return next(error)
  }
}
async function eliminar(req, res, next) {

  const { id } = idInmobiliariaSchema.parse(req.params)
  try {
    const resultado = await service.eliminar(id)
    if (!resultado) {
      return fallo(res, "NO_ENCONTRADO", { mensaje: "La inmobiliaria no existe" })
    }
    return exito(res, null)
  }
  catch (error) {
    return next(error)
  }
}
async function consultar(req, res, next) {
  const id = Number(req.usuario.idInmobi)
  try {
    const resultado = await service.buscarPorId(id)
    if (!resultado) {
      return fallo(res, "NO_ENCONTRADO", { mensaje: "La inmobiliaria no existe" })

    }
    return exito(res, resultado)
  }
  catch (error) {
    return next(error)
  }
}

async function editar(req, res, next) {
  const datos = editarInmobiliariaSchema.parse(req.body ?? {})
  if (!req.files?.logo && !Object.values(datos).some((valor) => valor !== undefined)) {
    return fallo(res, "DATOS_INVALIDOS", { mensaje: "No se envió ningún dato para actualizar" })
  }

  let nuevoLogo
  try {
    const id = Number(req.usuario.idInmobi)
    if (req.files?.logo) {
      const archivo = await archivos(req.files.logo, "logos")
      if (archivo.codigo !== "EXITO") return fallo(res, archivo.codigo)
      nuevoLogo = archivo.nombre
      datos.imagenLogo = nuevoLogo
    }

    const cambio = await service.actualizar(id, datos)
    if (!cambio) {
      if (nuevoLogo) await limpiar([{ destino: "logos", nombre: nuevoLogo }])
      return fallo(res, "NO_ENCONTRADO", { mensaje: "La inmobiliaria no existe" })
    }
    const logoConfirmado = nuevoLogo
    nuevoLogo = null
    if (logoConfirmado && cambio.imagenLogoAnterior) {
      await limpiar([{ destino: "logos", nombre: cambio.imagenLogoAnterior }])
    }
    return exito(res, cambio.inmobiliaria)
  }
  catch (error) {
    if (nuevoLogo) await limpiar([{ destino: "logos", nombre: nuevoLogo }])
    if (error.code === "ER_DUP_ENTRY") {
      return fallo(res, "CONFLICTO", { mensaje: "Ese dominio ya está en uso" })
    }
    return next(error)
  }
}

async function cambiarNombre(req, res, next) {
  const { id } = idInmobiliariaSchema.parse(req.params)
  const { nombre } = cambiarNombreSchema.parse(req.body ?? {})

  try {
    const cambio = await service.actualizar(id, { nombre })
    if (!cambio) {
      return fallo(res, "NO_ENCONTRADO", { mensaje: "La inmobiliaria no existe" })
    }
    return exito(res, cambio.inmobiliaria)
  }
  catch (error) {
    return next(error)
  }
}

module.exports = { listar, crear, eliminar, consultar, editar, cambiarNombre }
