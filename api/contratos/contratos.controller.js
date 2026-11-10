const service = require("./contratos.service")
const { exito, fallo } = require("../../utils/res")
const {
  crearContratoSchema,
  modificarContratoSchema,
  renovarContratoSchema,
  rescindirContratoSchema,
  idContratoSchema,
  contratosQuerySchema,
} = require("./contratos.schema")

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

module.exports = { listar, consultar, crear, modificar, renovar, rescindir }
