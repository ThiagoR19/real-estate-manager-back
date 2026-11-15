const service = require("./infoInmobiliaria.service")
const { exito, fallo } = require("../../utils/res")
const { idInmobiliariaSchema, propiedadesQuerySchema } = require("./infoInmobiliaria.schema")

async function consultar(req, res, next) {
  const { id } = idInmobiliariaSchema.parse(req.params)

  try {
    const inmobiliaria = await service.consultar(id)
    if (!inmobiliaria) {
      return fallo(res, "NO_ENCONTRADO", { mensaje: "La inmobiliaria no existe" })
    }
    return exito(res, inmobiliaria)
  }
  catch (error) {
    return next(error)
  }
}

// Público: propiedades publicadas de la inmobiliaria para la landing
async function propiedades(req, res, next) {
  const { id } = idInmobiliariaSchema.parse(req.params)
  const { limit } = propiedadesQuerySchema.parse(req.query)

  try {
    const inmobiliaria = await service.consultar(id)
    if (!inmobiliaria) {
      return fallo(res, "NO_ENCONTRADO", { mensaje: "La inmobiliaria no existe" })
    }
    return exito(res, await service.listarPropiedades(id, limit))
  }
  catch (error) {
    return next(error)
  }
}

module.exports = { consultar, propiedades }
