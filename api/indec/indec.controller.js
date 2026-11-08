const service = require("./indec.service")
const { exito, fallo } = require("../../utils/res")
const { crearIndecSchema, indecQuerySchema } = require("./indec.schema")

async function listar(req, res, next) {
  const { anio } = indecQuerySchema.parse(req.query)

  try {
    const resultado = await service.listar(req.usuario.idInmobi, anio)
    return exito(res, resultado.items)
  }
  catch (error) {
    return next(error)
  }
}

async function crear(req, res, next) {
  const cuerpo = crearIndecSchema.parse(req.body)

  try {
    const resultado = await service.crear(req.usuario.idInmobi, cuerpo)
    if (resultado.error) {
      return fallo(res, resultado.error, { mensaje: resultado.mensaje })
    }
    return exito(res, resultado.indec, { http: 201 })
  }
  catch (error) {
    return next(error)
  }
}

module.exports = { listar, crear }
