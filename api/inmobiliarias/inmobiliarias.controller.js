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
// Archivos que acepta el PUT /mia y la columna donde se guarda cada uno
const IMAGENES = [
  { campo: "logo", columna: "imagenLogo" },
  { campo: "banner", columna: "imagenBanner" },
  { campo: "principal", columna: "imagenPrincipal" },
]

const comoArchivos = (lista) => lista.map(({ columna, nombre }) => ({ destino: service.CARPETAS_IMAGENES[columna], nombre }))

// Edición parcial: solo se cambian los campos enviados; logo, banner y principal son opcionales
async function editar(req, res, next) {
  const datos = editarInmobiliariaSchema.parse(req.body ?? {})
  const hayImagenes = IMAGENES.some(({ campo }) => req.files?.[campo])
  if (!hayImagenes && !Object.values(datos).some((valor) => valor !== undefined)) {
    return fallo(res, "DATOS_INVALIDOS", { mensaje: "No se envió ningún dato para actualizar" })
  }

  const id = Number(req.usuario.idInmobi)
  let subidas = []
  try {
    for (const { campo, columna } of IMAGENES) {
      const archivo = req.files?.[campo]
      if (!archivo) continue
      const guardado = await archivos(archivo, service.CARPETAS_IMAGENES[columna])
      if (guardado.codigo !== "EXITO") {
        await limpiar(comoArchivos(subidas))
        return fallo(res, guardado.codigo, { mensaje: `No se pudo guardar la imagen de ${campo}` })
      }
      subidas.push({ columna, nombre: guardado.nombre })
      datos[columna] = guardado.nombre
    }

    const cambio = await service.actualizar(id, datos)
    if (!cambio) {
      await limpiar(comoArchivos(subidas))
      return fallo(res, "NO_ENCONTRADO", { mensaje: "La inmobiliaria no existe" })
    }

    const reemplazadas = subidas
      .filter(({ columna }) => cambio.imagenesAnteriores[columna])
      .map(({ columna }) => ({ columna, nombre: cambio.imagenesAnteriores[columna] }))
    subidas = []
    await limpiar(comoArchivos(reemplazadas))
    return exito(res, cambio.inmobiliaria)
  }
  catch (error) {
    await limpiar(comoArchivos(subidas))
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
