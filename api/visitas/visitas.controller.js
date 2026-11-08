const service = require("./visitas.service")
const { exito, fallo } = require("../../utils/res")
const {
  idVisitaSchema,
  programarVisitaSchema,
  modificarVisitaSchema,
  cancelarVisitaSchema,
  visitasQuerySchema,
} = require("./visitas.schema")

async function listar(req, res, next) {
  const filtros = visitasQuerySchema.parse(req.query)

  try {
    const resultado = await service.listar(req.usuario.idInmobi, filtros)
    return exito(res, resultado.items, { paginacion: resultado.paginacion })
  }
  catch (error) {
    return next(error)
  }
}

async function consultar(req, res, next) {
  const { id } = idVisitaSchema.parse(req.params)

  try {
    const visita = await service.buscarPorId(req.usuario.idInmobi, id)
    if (!visita) {
      return fallo(res, "NO_ENCONTRADO", { mensaje: "La visita no existe" })
    }
    return exito(res, visita)
  }
  catch (error) {
    return next(error)
  }
}

async function programar(req, res, next) {
  const cuerpo = programarVisitaSchema.parse(req.body)

  try {
    const resultado = await service.programar(req.usuario, cuerpo)
    if (resultado.error) {
      return fallo(res, resultado.error, { mensaje: resultado.mensaje })
    }
    return exito(res, resultado.visita, { http: 201 })
  }
  catch (error) {
    return next(error)
  }
}

async function modificar(req, res, next) {
  const { id } = idVisitaSchema.parse(req.params)
  const cuerpo = modificarVisitaSchema.parse(req.body)

  try {
    const resultado = await service.modificar(req.usuario, id, cuerpo)
    if (resultado.error) {
      return fallo(res, resultado.error, { mensaje: resultado.mensaje })
    }
    return exito(res, resultado.visita)
  }
  catch (error) {
    return next(error)
  }
}

async function cancelar(req, res, next) {
  const { id } = idVisitaSchema.parse(req.params)
  const { motivo } = cancelarVisitaSchema.parse(req.body)

  try {
    const resultado = await service.cancelar(req.usuario, id, motivo)
    if (resultado.error) {
      return fallo(res, resultado.error, { mensaje: resultado.mensaje })
    }
    return exito(res, resultado.visita)
  }
  catch (error) {
    return next(error)
  }
}

module.exports = { listar, consultar, programar, modificar, cancelar }
