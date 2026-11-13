const service = require("./auth.service")
const { codigoActivacionSchema, verificarDniSchema, loginSchema, registroSchema } = require("./auth.schema")
const { exito, fallo } = require("../../utils/res")

async function verificarDni(req, res) {
  const { codigo } = codigoActivacionSchema.parse(req.params)
  const { dni } = verificarDniSchema.parse(req.body)

  try {
    const resultado = await service.verificarDni(codigo, dni)
    if (resultado.error) return fallo(res, resultado.error, { mensaje: resultado.mensaje })
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

async function registrar(req, res) {
  const cuerpo = registroSchema.parse(req.body)
  try {
    const resultado = await service.registrar(cuerpo)
    if (resultado.error) return fallo(res, resultado.error, { mensaje: resultado.mensaje })
    return exito(res, resultado)
  } catch (error) {
    if (error.codigo) return fallo(res, error.codigo, { mensaje: error.message })
    return fallo(res, "ERROR_INTERNO")
  }
}

async function logout(req, res) {
  try {
    await service.logout(req.usuario, req.token)
    return exito(res, { sesionCerrada: true })
  } catch (error) {
    if (error.codigo) return fallo(res, error.codigo)
    return fallo(res, "ERROR_INTERNO")
  }
}

module.exports = { verificarDni, registrar, login, logout }
