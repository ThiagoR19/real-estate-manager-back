const path = require("path")
const service = require("./contratos.service")
const documentos = require("../documentos/documentos.service")
const archivos = require("../../utils/archivos")
const { exito, fallo } = require("../../utils/res")
const {
  crearContratoSchema,
  modificarContratoSchema,
  renovarContratoSchema,
  rescindirContratoSchema,
  idContratoSchema,
  idDocumentoSchema,
  documentoSchema,
  contratosQuerySchema,
} = require("./contratos.schema")

const CARPETA_DOCUMENTOS = "documentos"

function responder(res, resultado, http = 200) {
  if (resultado.error) {
    return fallo(res, resultado.error, { mensaje: resultado.mensaje, detalles: resultado.detalles })
  }
  return exito(res, resultado.contrato, { http })
}

async function listar(req, res, next) {
  const filtros = contratosQuerySchema.parse(req.query)

  try {
    const resultado = await service.listar(req.usuario, filtros)
    return exito(res, resultado.items, { paginacion: resultado.paginacion })
  }
  catch (error) {
    return next(error)
  }
}

async function consultar(req, res, next) {
  const { id } = idContratoSchema.parse(req.params)

  try {
    const contrato = await service.buscarPorId(req.usuario, id)
    if (!contrato) {
      return fallo(res, "NO_ENCONTRADO", { mensaje: "El contrato no existe" })
    }
    return exito(res, contrato)
  }
  catch (error) {
    return next(error)
  }
}

async function crear(req, res, next) {
  const cuerpo = crearContratoSchema.parse(req.body)

  try {
    return responder(res, await service.crear(req.usuario, cuerpo), 201)
  }
  catch (error) {
    return next(error)
  }
}

async function modificar(req, res, next) {
  const { id } = idContratoSchema.parse(req.params)
  const cuerpo = modificarContratoSchema.parse(req.body)

  try {
    return responder(res, await service.modificar(req.usuario, id, cuerpo))
  }
  catch (error) {
    return next(error)
  }
}

async function renovar(req, res, next) {
  const { id } = idContratoSchema.parse(req.params)
  const cuerpo = renovarContratoSchema.parse(req.body)

  try {
    return responder(res, await service.renovar(req.usuario, id, cuerpo), 201)
  }
  catch (error) {
    return next(error)
  }
}

async function rescindir(req, res, next) {
  const { id } = idContratoSchema.parse(req.params)
  const cuerpo = rescindirContratoSchema.parse(req.body)

  try {
    return responder(res, await service.rescindir(req.usuario, id, cuerpo))
  }
  catch (error) {
    return next(error)
  }
}

async function borrarArchivo(nombre) {
  try {
    await archivos.eliminar(CARPETA_DOCUMENTOS, nombre, true)
  } catch (error) {
    console.error(error)
  }
}

async function subirDocumento(req, res, next) {
  const { id } = idContratoSchema.parse(req.params)
  const { nombre } = documentoSchema.parse(req.body ?? {})

  const otrosCampos = Object.keys(req.files || {}).filter((campo) => campo !== "documento")
  if (otrosCampos.length) {
    return fallo(res, "DATOS_INVALIDOS", { mensaje: "Solo se admite el archivo documento" })
  }
  if (Array.isArray(req.files?.documento)) {
    return fallo(res, "DATOS_INVALIDOS", { mensaje: "Solo se admite un documento por petición" })
  }

  try {
    const contrato = await service.buscarPorId(req.usuario, id)
    if (!contrato) {
      return fallo(res, "NO_ENCONTRADO", { mensaje: "El contrato no existe" })
    }

    const guardado = await archivos(req.files?.documento, CARPETA_DOCUMENTOS, ["pdf", "imagen"], { privado: true })
    if (guardado.codigo !== "EXITO") {
      if (guardado.error) {
        console.error(guardado.error)
      }
      return fallo(res, guardado.codigo)
    }

    const base = nombre.replace(/[\\/:*?"<>|]/g, "").slice(0, 200) || "documento"
    try {
      await documentos.registrarDeContrato(req.usuario.idInmobi, id, {
        titulo: nombre,
        tipo: guardado.mimeType === "application/pdf" ? "PDF" : "IMAGEN",
        nombreArchivo: `${base}${path.extname(guardado.nombre)}`,
        rutaArchivo: guardado.nombre,
        mimeType: guardado.mimeType,
        tamanioBytes: guardado.tamanioBytes,
        idUsuario: req.usuario.id,
      })
    } catch (error) {
      await borrarArchivo(guardado.nombre)
      throw error
    }

    return exito(res, await service.buscarPorId(req.usuario, id), { http: 201 })
  }
  catch (error) {
    return next(error)
  }
}

async function descargarDocumento(req, res, next) {
  const { id, idDocumento } = idDocumentoSchema.parse(req.params)

  try {
    const contrato = await service.buscarPorId(req.usuario, id)
    if (!contrato) {
      return fallo(res, "NO_ENCONTRADO", { mensaje: "El contrato no existe" })
    }
    const documento = await documentos.buscarDeContrato(req.usuario.idInmobi, id, idDocumento)
    if (!documento) {
      return fallo(res, "NO_ENCONTRADO", { mensaje: "El documento no existe" })
    }

    res.set("X-Content-Type-Options", "nosniff")
    return res.download(archivos.rutaArchivo(CARPETA_DOCUMENTOS, documento.rutaArchivo, true), documento.nombreArchivo, (error) => {
      if (!error) return
      if (res.headersSent) return console.error(error)
      if (error.code === "ENOENT") return fallo(res, "NO_ENCONTRADO", { mensaje: "El documento no existe" })
      return next(error)
    })
  }
  catch (error) {
    return next(error)
  }
}

module.exports = { listar, consultar, crear, modificar, renovar, rescindir, subirDocumento, descargarDocumento }
