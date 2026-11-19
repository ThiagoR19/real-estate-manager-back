const service = require("./contVisitas.service")
const { exito, fallo } = require("../../utils/res")
const { crearTokenVisita, leerTokenVisita } = require("../../utils/token")
const { sumarVisitaSchema, visitasQuerySchema } = require("./contVisitas.schema")

async function sumar(req, res, next) {
  const { idInmobiliaria, token } = sumarVisitaSchema.parse(req.body ?? {})

  try {
    if (token) {
      const actual = leerTokenVisita(token)
      if (actual.estado === "VIGENTE" && actual.idInmobiliaria === idInmobiliaria) {
        return exito(res, { contabilizada: false, token, expira: actual.expira })
      }
    }

    const resultado = await service.sumar(idInmobiliaria)
    if (resultado.error) {
      return fallo(res, resultado.error, { mensaje: resultado.mensaje })
    }
    return exito(res, { contabilizada: true, ...crearTokenVisita(idInmobiliaria) })
  }
  catch (error) {
    return next(error)
  }
}

async function listar(req, res, next) {
  const query = visitasQuerySchema.parse(req.query)

  try {
    return exito(res, await service.listar(req.usuario.idInmobi, query))
  }
  catch (error) {
    return next(error)
  }
}

module.exports = { sumar, listar }
