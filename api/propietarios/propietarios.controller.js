const archivos = require("../../utils/archivos")
const { z } = require("zod")
const idArchivoSchema = z.coerce.number().int().positive().max(2147483647)
const service = require("./propietarios.service")
const { crearPropietarioSchema, actualizarPropietarioSchema, idPropietarioSchema, propietariosQuerySchema } = require("./propietarios.schema")
const { exito, fallo } = require("../../utils/res")

async function listar(req, res) {
  const query = propietariosQuerySchema.parse(req.query)

  try {
    const resultado = await service.listar(req.usuario, query)
    return exito(res, resultado.items, { paginacion: resultado.paginacion })
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

async function crear(req, res) {
  const cuerpo = crearPropietarioSchema.parse(req.body)

  try {
    const resultado = await service.crear(req.usuario, cuerpo)
    return exito(res, resultado, { http: 201 })
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

async function actualizar(req, res) {
  const { id } = idPropietarioSchema.parse(req.params)
  const cuerpo = actualizarPropietarioSchema.parse(req.body)

  try {
    const resultado = await service.actualizar(req.usuario, id, cuerpo)
    return exito(res, resultado)
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

async function eliminar(req, res) {
  const { id } = idPropietarioSchema.parse(req.params)

  try {
    await service.eliminar(req.usuario, id)
    return exito(res, { id })
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

async function listarArchivos(req, res, next) {
  try { return exito(res, await service.listarArchivos(req.entidadArchivos)) }
  catch (error) { next(error) }
}

async function cargarFoto(req, res, next) {
  try { return exito(res, await service.cargarFoto(req.entidadArchivos, req.archivos)) }
  catch (error) { return error.codigo ? fallo(res, error.codigo) : next(error) }
}

async function eliminarFoto(req, res, next) {
  try {
    await service.eliminarFoto(req.entidadArchivos)
    return exito(res, null)
  } catch (error) { return error.codigo ? fallo(res, error.codigo) : next(error) }
}

async function cargarDocumentos(req, res, next) {
  try { return exito(res, await service.cargarDocumentos(req.entidadArchivos, req.archivos, req.usuario.id), { http: 201 }) }
  catch (error) { return error.codigo ? fallo(res, error.codigo) : next(error) }
}

async function modificarDocumento(req, res, next) {
  const idArchivo = idArchivoSchema.parse(req.params.idArchivo)
  try { return exito(res, await service.modificarDocumento(req.entidadArchivos, idArchivo, req.archivos, req.usuario.id)) }
  catch (error) { return error.codigo ? fallo(res, error.codigo) : next(error) }
}

async function descargarDocumento(req, res, next) {
  const idArchivo = idArchivoSchema.parse(req.params.idArchivo)
  try {
    const [documento] = await service.buscarDocumento(req.entidadArchivos, idArchivo)
    if (!documento) return fallo(res, "NO_ENCONTRADO")
    res.download(archivos.rutaArchivo("documentos", documento.rutaArchivo, true), documento.nombreArchivo, (error) => {
      if (!error) return
      if (res.headersSent) return next(error)
      if (error.code === "ENOENT") return fallo(res, "NO_ENCONTRADO")
      next(error)
    })
  } catch (error) { next(error) }
}

async function eliminarDocumento(req, res, next) {
  const idArchivo = idArchivoSchema.parse(req.params.idArchivo)
  try {
    await service.eliminarDocumento(req.entidadArchivos, idArchivo)
    return exito(res, null)
  } catch (error) { return error.codigo ? fallo(res, error.codigo) : next(error) }
}

module.exports = { listar, crear, actualizar, eliminar , listarArchivos, cargarFoto, eliminarFoto, cargarDocumentos, modificarDocumento, descargarDocumento, eliminarDocumento}
