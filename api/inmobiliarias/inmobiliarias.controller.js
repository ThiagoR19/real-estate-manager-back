const service = require("./inmobiliarias.service")
const { exito, fallo } = require("../../utils/res")
const archivos = require("../../utils/archivos")

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
// Edición parcial: solo se cambian los campos enviados; el logo es opcional
async function editar(req, res, next) {
  let datos = editarInmobiliariaSchema.parse(req.body ?? {})

  if (req.files?.logo) {
    const imgsCont = await archivos(req.files.logo, "logos")
    if (imgsCont.codigo != "EXITO") {
      return fallo(res, imgsCont.codigo)
    }
    datos.imagenLogo = imgsCont.nombre
  }

  if (!Object.values(datos).some((valor) => valor !== undefined)) {
    return fallo(res, "DATOS_INVALIDOS", { mensaje: "No se envió ningún dato para actualizar" })
  }

  try {
    const id = Number(req.usuario.idInmobi)

    const resultado = await service.actualizar(id, datos)
    if (resultado) {
      return exito(res, resultado)
    }
    return fallo(res, "NO_ENCONTRADO", { mensaje: "La inmobiliaria no existe" })
  }
  catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return fallo(res, "CONFLICTO", { mensaje: "Ese dominio ya está en uso" })
    }
    return next(error)
  }
}
// Superadmin: solo cambia el nombre de cualquier inmobiliaria
async function cambiarNombre(req, res, next) {
  const { id } = idInmobiliariaSchema.parse(req.params)
  const { nombre } = cambiarNombreSchema.parse(req.body ?? {})

  try {
    const resultado = await service.actualizar(id, { nombre })
    if (!resultado) {
      return fallo(res, "NO_ENCONTRADO", { mensaje: "La inmobiliaria no existe" })
    }
    return exito(res, resultado)
  }
  catch (error) {
    return next(error)
  }
}

module.exports = { listar, crear, eliminar, consultar, editar, cambiarNombre }