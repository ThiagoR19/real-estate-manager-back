const archivos = require("../../utils/archivos")
const { z } = require("zod")
const idArchivoSchema = z.coerce.number().int().positive().max(2147483647)
const service = require("./propiedades.service")
const { crearPropiedadSchema, actualizarPropiedadSchema, idPropiedadSchema, propiedadesQuerySchema, } = require("./propiedades.schema")
const { exito, fallo } = require("../../utils/res")

async function catalogos(req, res, next) {
  try { return exito(res, await service.catalogos(req.usuario)) }
  catch (error) { next(error) }
}

async function listar(req, res) {
  const query = propiedadesQuerySchema.parse(req.query)

  const resultado = await service.listar(req.usuario, query)
  return exito(res, resultado.items, { paginacion: resultado.paginacion })
}

async function obtenerPorId(req, res) {
  const { id } = idPropiedadSchema.parse(req.params)

  const resultado = await service.buscarPorId(req.usuario, id)
  return resultado ? exito(res, resultado) : fallo(res, "NO_ENCONTRADO")
}

async function crear(req, res) {
  const cuerpo = crearPropiedadSchema.parse(req.body)

  const resultado = await service.crear(req.usuario, cuerpo)
  return exito(res, resultado, { http: 201 })
}

async function actualizar(req, res) {
  const { id } = idPropiedadSchema.parse(req.params)
  const cuerpo = actualizarPropiedadSchema.parse(req.body)

  const resultado = await service.actualizar(req.usuario, id, cuerpo)
  return resultado ? exito(res, resultado) : fallo(res, "NO_ENCONTRADO")
}

async function eliminar(req, res) {
  const { id } = idPropiedadSchema.parse(req.params)

  const eliminado = await service.eliminar(req.usuario, id)
  return eliminado ? exito(res, { id }) : fallo(res, "NO_ENCONTRADO")
}

async function listarArchivos(req, res, next) {
  try { return exito(res, await service.listarArchivos(req.entidadArchivos)) }
  catch (error) { next(error) }
}

async function cargarImagenes(req, res, next) {
  try { return exito(res, await service.cargarImagenes(req.entidadArchivos, req.archivos), { http: 201 }) }
  catch (error) { return error.codigo ? fallo(res, error.codigo) : next(error) }
}

async function modificarImagen(req, res, next) {
  const idArchivo = idArchivoSchema.parse(req.params.idArchivo)
  try { return exito(res, await service.modificarImagen(req.entidadArchivos, idArchivo, req.archivos)) }
  catch (error) { return error.codigo ? fallo(res, error.codigo) : next(error) }
}

async function eliminarImagen(req, res, next) {
  const idArchivo = idArchivoSchema.parse(req.params.idArchivo)
  try {
    await service.eliminarImagen(req.entidadArchivos, idArchivo)
    return exito(res, null)
  } catch (error) { return error.codigo ? fallo(res, error.codigo) : next(error) }
}

async function cargarDocumentos(req, res, next) {
  try { return exito(res, await service.cargarDocumentos(req.entidadArchivos, req.archivos, req.usuario.id, req.body?.titulo), { http: 201 }) }
  catch (error) { return error.codigo ? fallo(res, error.codigo) : next(error) }
}

async function renombrarDocumento(req, res, next) {
  const idArchivo = idArchivoSchema.parse(req.params.idArchivo)
  const { titulo } = z.object({ titulo: z.string().trim().min(1).max(255) }).strict().parse(req.body)
  try { return exito(res, await service.renombrarDocumento(req.entidadArchivos, idArchivo, titulo)) }
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

module.exports = { catalogos, listar, obtenerPorId, crear, actualizar, eliminar , listarArchivos, cargarImagenes, modificarImagen, eliminarImagen, cargarDocumentos, renombrarDocumento, modificarDocumento, descargarDocumento, eliminarDocumento}
