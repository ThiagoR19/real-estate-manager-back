const path = require("path")
const service = require("./pagos.service")
const archivos = require("../../utils/archivos")
const { exito, fallo } = require("../../utils/res")
const { emitirNotificacion } = require("../notificaciones/notificaciones.eventos")
const {
  crearPagoSchema,
  modificarPagoSchema,
  marcarPagadoSchema,
  cargarComprobanteQuerySchema,
  motivoPagoSchema,
  aprobarPagoSchema,
  rechazarPagoSchema,
  crearConceptoSchema,
  idPagoSchema,
  registrarPagoParamsSchema,
  prepararPagoSchema,
  personasQuerySchema,
  pagosQuerySchema,
} = require("./pagos.schema")

const CARPETA = "comprobantes"

function responder(res, resultado, http = 200, clave = "pago") {
  if (resultado.error) {
    return fallo(res, resultado.error, { mensaje: resultado.mensaje, detalles: resultado.detalles })
  }
  if (resultado.aviso) emitirNotificacion(resultado.aviso)
  return exito(res, resultado[clave], { http })
}

async function borrarArchivo(nombre) {
  try {
    await archivos.eliminar(CARPETA, nombre, true)
  } catch (error) {
    console.error(error)
  }
}

async function guardarComprobante(req, res) {
  const archivo = req.archivos[0]
  const guardado = await archivos(archivo, CARPETA, ["imagen", "pdf"], { privado: true })
  if (guardado.codigo !== "EXITO") {
    if (guardado.error) {
      console.error(guardado.error)
    }
    fallo(res, guardado.codigo, guardado.codigo === "NO_FORMATO" ? { mensaje: "Solo se admiten imágenes o archivos PDF" } : {})
    return null
  }

  const base = path.parse(String(archivo.name || "comprobante")).name.replace(/[\\/:*?"<>|]/g, "").slice(0, 200) || "comprobante"
  return { nombreArchivo: `${base}${path.extname(guardado.nombre)}`, rutaArchivo: guardado.nombre }
}

function enviarArchivo(res, next, comprobante) {
  if (!comprobante) {
    return fallo(res, "NO_ENCONTRADO", { mensaje: "El pago no tiene comprobante" })
  }
  let ruta
  try {
    ruta = archivos.rutaArchivo(CARPETA, comprobante.rutaArchivo, true)
  } catch {
    return fallo(res, "NO_ENCONTRADO", { mensaje: "El archivo no está disponible" })
  }

  res.set({ "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" })
  return res.download(ruta, comprobante.nombreArchivo, (error) => {
    if (!error) return
    if (res.headersSent) return console.error(error)
    if (error.code === "ENOENT") return fallo(res, "NO_ENCONTRADO", { mensaje: "El archivo no está disponible" })
    return next(error)
  })
}

async function listarConceptos(req, res, next) {
  try {
    return exito(res, await service.listarConceptos(req.usuario.idInmobi))
  }
  catch (error) {
    return next(error)
  }
}

async function crearConcepto(req, res, next) {
  const cuerpo = crearConceptoSchema.parse(req.body)

  try {
    return responder(res, await service.crearConcepto(req.usuario, cuerpo), 201, "concepto")
  }
  catch (error) {
    return next(error)
  }
}

async function listarInquilinos(req, res, next) {
  const { q } = personasQuerySchema.parse(req.query)

  try {
    return exito(res, await service.listarInquilinos(req.usuario, q))
  }
  catch (error) {
    return next(error)
  }
}

async function preparar(req, res, next) {
  const filtros = prepararPagoSchema.parse(req.query)

  try {
    return responder(res, await service.preparar(req.usuario, filtros), 200, "datos")
  }
  catch (error) {
    return next(error)
  }
}

async function listar(req, res, next) {
  const filtros = pagosQuerySchema.parse(req.query)

  try {
    const resultado = await service.listar(req.usuario, filtros)
    return exito(res, resultado.items, { paginacion: resultado.paginacion })
  }
  catch (error) {
    return next(error)
  }
}

async function listarContratosDisponibles(req, res, next) {
  try {
    return responder(res, await service.listarContratosDisponibles(req.usuario), 200, "contratos")
  } catch (error) {
    return next(error)
  }
}

async function consultar(req, res, next) {
  const { id } = idPagoSchema.parse(req.params)

  try {
    const pago = await service.buscarPorId(req.usuario, id)
    if (!pago) {
      return fallo(res, "NO_ENCONTRADO", { mensaje: "El pago no existe" })
    }
    return exito(res, pago)
  }
  catch (error) {
    return next(error)
  }
}

async function descargarComprobante(req, res, next) {
  const { id } = idPagoSchema.parse(req.params)

  try {
    return enviarArchivo(res, next, await service.comprobanteParaDescargar(req.usuario, id))
  }
  catch (error) {
    return next(error)
  }
}

async function crear(req, res, next) {
  const cuerpo = crearPagoSchema.parse(req.body)

  try {
    return responder(res, await service.crear(req.usuario, cuerpo), 201)
  }
  catch (error) {
    return next(error)
  }
}

async function modificar(req, res, next) {
  const { id } = idPagoSchema.parse(req.params)
  const cuerpo = modificarPagoSchema.parse(req.body)

  try {
    return responder(res, await service.modificar(req.usuario, id, cuerpo))
  }
  catch (error) {
    return next(error)
  }
}

async function eliminar(req, res, next) {
  const { id } = idPagoSchema.parse(req.params)

  try {
    return responder(res, await service.eliminar(req.usuario, id))
  }
  catch (error) {
    return next(error)
  }
}

async function procesarComprobante(req, res, next, guardarRegistro) {
  try {
    const archivo = await guardarComprobante(req, res)
    if (!archivo) {
      return
    }
    let resultado
    try {
      resultado = await guardarRegistro(archivo)
    } catch (error) {
      await borrarArchivo(archivo.rutaArchivo)
      throw error
    }
    if (resultado.error) await borrarArchivo(archivo.rutaArchivo)
    return responder(res, resultado, 201)
  }
  catch (error) {
    return next(error)
  }
}

function cargarComprobante(req, res, next) {
  const { id } = idPagoSchema.parse(req.params)
  const { enviar } = cargarComprobanteQuerySchema.parse(req.query)
  return procesarComprobante(req, res, next, (archivo) =>
    service.cargarComprobante(req.usuario, id, archivo, { enviar: enviar === "1" }))
}

function registrarConComprobante(req, res, next) {
  const params = registrarPagoParamsSchema.parse(req.params)
  return procesarComprobante(req, res, next, (archivo) =>
    service.registrarConComprobante(req.usuario, params, archivo))
}

async function solicitarRevision(req, res, next) {
  const { id } = idPagoSchema.parse(req.params)
  const { motivo } = motivoPagoSchema.parse(req.body)
  try {
    return responder(res, await service.solicitarRevision(req.usuario, id, motivo), 201, "solicitud")
  } catch (error) {
    return next(error)
  }
}

async function marcarPagado(req, res, next) {
  const { id } = idPagoSchema.parse(req.params)
  const cuerpo = marcarPagadoSchema.parse(req.body ?? {})

  try {
    return responder(res, await service.marcarPagado(req.usuario, id, cuerpo))
  }
  catch (error) {
    return next(error)
  }
}

async function aprobar(req, res, next) {
  const { id } = idPagoSchema.parse(req.params)
  const cuerpo = aprobarPagoSchema.parse(req.body ?? {})

  try {
    return responder(res, await service.aprobar(req.usuario, id, cuerpo))
  }
  catch (error) {
    return next(error)
  }
}

async function rechazar(req, res, next) {
  const { id } = idPagoSchema.parse(req.params)
  const cuerpo = rechazarPagoSchema.parse(req.body)

  try {
    return responder(res, await service.rechazar(req.usuario, id, cuerpo))
  }
  catch (error) {
    return next(error)
  }
}

module.exports = {
  listarConceptos,
  crearConcepto,
  listarInquilinos,
  preparar,
  listar,
  listarContratosDisponibles,
  consultar,
  descargarComprobante,
  crear,
  modificar,
  eliminar,
  cargarComprobante,
  registrarConComprobante,
  solicitarRevision,
  marcarPagado,
  aprobar,
  rechazar,
  guardarComprobante,
  borrarArchivo,
  enviarArchivo,
}
