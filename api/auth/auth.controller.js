const service = require("./auth.service")
const {
  codigoActivacionSchema,
  activarSchema,
  loginSchema,
} = require("./auth.schema")
const { exito, fallo } = require("../../utils/res")

async function activar(req, res) {
  const { codigo } = codigoActivacionSchema.parse(req.params)
  const cuerpo = activarSchema.parse(req.body)

  try {
    const resultado = await service.activar(codigo, cuerpo)
    return exito(res, resultado)
  } catch (error) {
    if (error.codigo) {
      const opciones = error.message ? { mensaje: error.message } : {}
      return fallo(res, error.codigo, opciones)
    }
    return fallo(res, "ERROR_INTERNO")
  }
}

async function login(req, res) {
  const cuerpo = loginSchema.parse(req.body)

  try {
    const resultado = await service.login(cuerpo)
    return exito(res, resultado)
  } catch (error) {
    if (error.codigo) {
      const opciones = error.message ? { mensaje: error.message } : {}
      return fallo(res, error.codigo, opciones)
    }
    return fallo(res, "ERROR_INTERNO")
  }
}

module.exports = { activar, login }
