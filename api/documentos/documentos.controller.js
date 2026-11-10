const path = require("path")
const service = require("./documentos.service")
const archivos = require("../../utils/archivos")
const { exito, fallo } = require("../../utils/res")
const {
  crearDocumentoSchema,
  nuevaVersionSchema,
  actualizarDocumentoSchema,
  archivarDocumentoSchema,
  desarchivarDocumentoSchema,
  idDocumentoSchema,
  idVersionSchema,
  documentosQuerySchema,
} = require("./documentos.schema")
const { ADMIN, AGENTE } = require("../../config/roles")

const CARPETA = "documentos"

function responder(res, resultado, http = 200) {
  if (resultado.error) {
    return fallo(res, resultado.error, { mensaje: resultado.mensaje })
  }
  return exito(res, resultado.documento, { http })
}

async function borrarArchivo(nombre) {
  try {
    await archivos.eliminar(CARPETA, nombre, true)
  } catch (error) {
    console.error(error)
  }
}

async function guardarPdf(req, res) {
  const otros = Object.keys(req.files || {}).filter((campo) => campo !== "archivo")
  if (otros.length) {
    fallo(res, "DATOS_INVALIDOS", { mensaje: "Solo se admite el archivo en el campo archivo" })
    return null
  }
  if (Array.isArray(req.files?.archivo)) {
    fallo(res, "DATOS_INVALIDOS", { mensaje: "Solo se admite un archivo por petición" })
    return null
  }

  const archivo = req.files?.archivo
  const guardado = await archivos(archivo, CARPETA, ["pdf"], { privado: true })
  if (guardado.codigo !== "EXITO") {
    if (guardado.error) {
      console.error(guardado.error)
    }
    fallo(res, guardado.codigo, guardado.codigo === "NO_FORMATO" ? { mensaje: "Solo se admiten archivos PDF" } : {})
    return null
  }

  const base = path.parse(String(archivo.name || "documento")).name.replace(/[\\/:*?"<>|]/g, "").slice(0, 200) || "documento"
  return {
    nombreArchivo: `${base}.pdf`,
    rutaArchivo: guardado.nombre,
    mimeType: guardado.mimeType,
    tamanioBytes: guardado.tamanioBytes,
  }
}

async function listar(req, res, next) {
  const filtros = documentosQuerySchema.parse(req.query)
  if (filtros.archivados === "true" && ![ADMIN, AGENTE].includes(req.usuario.rol)) {
    return fallo(res, "SIN_PERMISO", { mensaje: "Solo el personal de la inmobiliaria ve documentos archivados" })
  }

  try {
    const resultado = await service.listar(req.usuario, filtros)
    return exito(res, resultado.items, { paginacion: resultado.paginacion })
  }
  catch (error) {
    return next(error)
  }
}

async function consultar(req, res, next) {
  const { id } = idDocumentoSchema.parse(req.params)

  try {
    const documento = await service.buscarPorId(req.usuario, id)
    if (!documento) {
      return fallo(res, "NO_ENCONTRADO", { mensaje: "El documento no existe" })
    }
    return exito(res, documento)
  }
  catch (error) {
    return next(error)
  }
}

async function enviarArchivo(res, next, version) {
  if (!version) {
    return fallo(res, "NO_ENCONTRADO", { mensaje: "El documento no existe" })
  }
  let ruta
  try {
    ruta = archivos.rutaArchivo(CARPETA, version.rutaArchivo, true)
  } catch {
    return fallo(res, "NO_ENCONTRADO", { mensaje: "El archivo no está disponible" })
  }

  res.set("X-Content-Type-Options", "nosniff")
  return res.download(ruta, version.nombreArchivo, (error) => {
    if (!error) return
    if (res.headersSent) return console.error(error)
    if (error.code === "ENOENT") return fallo(res, "NO_ENCONTRADO", { mensaje: "El archivo no está disponible" })
    return next(error)
  })
}

async function descargar(req, res, next) {
  const { id } = idDocumentoSchema.parse(req.params)

  try {
    return enviarArchivo(res, next, await service.archivoParaDescargar(req.usuario, id))
  }
  catch (error) {
    return next(error)
  }
}

async function descargarVersion(req, res, next) {
  const { id, numero } = idVersionSchema.parse(req.params)

  try {
    return enviarArchivo(res, next, await service.archivoParaDescargar(req.usuario, id, numero))
  }
  catch (error) {
    return next(error)
  }
}

async function crear(req, res, next) {
  const datos = crearDocumentoSchema.parse(req.body ?? {})

  try {
    const archivo = await guardarPdf(req, res)
    if (!archivo) {
      return
    }
    try {
      const resultado = await service.crear(req.usuario, datos, archivo)
      if (resultado.error) {
        await borrarArchivo(archivo.rutaArchivo)
      }
      return responder(res, resultado, 201)
    } catch (error) {
      await borrarArchivo(archivo.rutaArchivo)
      throw error
    }
  }
  catch (error) {
    return next(error)
  }
}

async function agregarVersion(req, res, next) {
  const { id } = idDocumentoSchema.parse(req.params)
  const { comentario } = nuevaVersionSchema.parse(req.body ?? {})

  try {
    const archivo = await guardarPdf(req, res)
    if (!archivo) {
      return
    }
    try {
      const resultado = await service.agregarVersion(req.usuario, id, comentario, archivo)
      if (resultado.error) {
        await borrarArchivo(archivo.rutaArchivo)
      }
      return responder(res, resultado, 201)
    } catch (error) {
      await borrarArchivo(archivo.rutaArchivo)
      throw error
    }
  }
  catch (error) {
    return next(error)
  }
}

async function actualizar(req, res, next) {
  const { id } = idDocumentoSchema.parse(req.params)
  const cambios = actualizarDocumentoSchema.parse(req.body)

  try {
    return responder(res, await service.actualizar(req.usuario, id, cambios))
  }
  catch (error) {
    return next(error)
  }
}

async function archivar(req, res, next) {
  const { id } = idDocumentoSchema.parse(req.params)
  const { motivo } = archivarDocumentoSchema.parse(req.body)

  try {
    return responder(res, await service.archivar(req.usuario, id, motivo))
  }
  catch (error) {
    return next(error)
  }
}

async function desarchivar(req, res, next) {
  const { id } = idDocumentoSchema.parse(req.params)
  desarchivarDocumentoSchema.parse(req.body)

  try {
    return responder(res, await service.desarchivar(req.usuario, id))
  }
  catch (error) {
    return next(error)
  }
}

module.exports = { listar, consultar, descargar, descargarVersion, crear, agregarVersion, actualizar, archivar, desarchivar }
