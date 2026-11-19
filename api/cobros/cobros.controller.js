const service = require("./cobros.service")
const { guardarComprobante, borrarArchivo, enviarArchivo } = require("../pagos/pagos.controller")
const { motivoPagoSchema } = require("../pagos/pagos.schema")
const { emitirNotificacion } = require("../notificaciones/notificaciones.eventos")
const { exito, fallo } = require("../../utils/res")
const {
  crearCobroSchema,
  modificarCobroSchema,
  idCobroSchema,
  prepararCobroSchema,
  personasQuerySchema,
  cobrosQuerySchema,
} = require("./cobros.schema")

function responder(res, resultado, http = 200, clave = "cobro") {
  if (resultado.error) {
    return fallo(res, resultado.error, { mensaje: resultado.mensaje, detalles: resultado.detalles })
  }
  if (resultado.aviso) emitirNotificacion(resultado.aviso)
  return exito(res, resultado[clave], { http })
}

async function listarPropietarios(req, res, next) {
  const { q } = personasQuerySchema.parse(req.query)

  try {
    return exito(res, await service.listarPropietarios(req.usuario, q))
  }
  catch (error) {
    return next(error)
  }
}

async function preparar(req, res, next) {
  const filtros = prepararCobroSchema.parse(req.query)

  try {
    return responder(res, await service.preparar(req.usuario, filtros), 200, "datos")
  }
  catch (error) {
    return next(error)
  }
}

async function listar(req, res, next) {
  const filtros = cobrosQuerySchema.parse(req.query)

  try {
    const resultado = await service.listar(req.usuario, filtros)
    return exito(res, resultado.items, { paginacion: resultado.paginacion })
  }
  catch (error) {
    return next(error)
  }
}

async function consultar(req, res, next) {
  const { id } = idCobroSchema.parse(req.params)

  try {
    const cobro = await service.buscarPorId(req.usuario, id)
    if (!cobro) {
      return fallo(res, "NO_ENCONTRADO", { mensaje: "La liquidación no existe" })
    }
    return exito(res, cobro)
  }
  catch (error) {
    return next(error)
  }
}

async function descargarComprobante(req, res, next) {
  const { id } = idCobroSchema.parse(req.params)

  try {
    return enviarArchivo(res, next, await service.comprobanteParaDescargar(req.usuario, id))
  }
  catch (error) {
    return next(error)
  }
}

async function solicitarRevision(req, res, next) {
  const { id } = idCobroSchema.parse(req.params)
  const { motivo } = motivoPagoSchema.parse(req.body)
  try {
    return responder(res, await service.solicitarRevision(req.usuario, id, motivo), 201, "solicitud")
  } catch (error) {
    return next(error)
  }
}

async function crear(req, res, next) {
  const cuerpo = crearCobroSchema.parse(req.body)

  try {
    return responder(res, await service.crear(req.usuario, cuerpo), 201)
  }
  catch (error) {
    return next(error)
  }
}

async function modificar(req, res, next) {
  const { id } = idCobroSchema.parse(req.params)
  const cuerpo = modificarCobroSchema.parse(req.body)

  try {
    return responder(res, await service.modificar(req.usuario, id, cuerpo))
  }
  catch (error) {
    return next(error)
  }
}

async function cargarComprobante(req, res, next) {
  const { id } = idCobroSchema.parse(req.params)

  try {
    const archivo = await guardarComprobante(req, res)
    if (!archivo) {
      return
    }
    try {
      const resultado = await service.cargarComprobante(req.usuario, id, archivo)
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

async function marcarPagado(req, res, next) {
  const { id } = idCobroSchema.parse(req.params)

  try {
    return responder(res, await service.marcarPagado(req.usuario, id))
  }
  catch (error) {
    return next(error)
  }
}

async function eliminar(req, res, next) {
  const { id } = idCobroSchema.parse(req.params)

  try {
    return responder(res, await service.eliminar(req.usuario, id))
  }
  catch (error) {
    return next(error)
  }
}

module.exports = {
  listarPropietarios,
  preparar,
  listar,
  consultar,
  descargarComprobante,
  solicitarRevision,
  crear,
  modificar,
  cargarComprobante,
  marcarPagado,
  eliminar,
}
