const service = require("./agentes.service")
const {
  crearAgenteSchema,
  actualizarAgenteSchema,
  idAgenteSchema,
  rolAgenteSchema,
  agentesQuerySchema,
} = require("./agentes.schema")
const { exito, fallo } = require("../../utils/res")

async function listar(req, res) {
  const query = agentesQuerySchema.parse(req.query)

  try {
    const resultado = await service.listar(req.usuario, query)
    return exito(res, resultado.items, { paginacion: resultado.paginacion })
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

async function obtener(req, res) {
  const { id } = idAgenteSchema.parse(req.params)

  try {
    const resultado = await service.buscarPorId(req.usuario, id)
    return exito(res, resultado)
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

async function crear(req, res) {
  const cuerpo = crearAgenteSchema.parse(req.body)

  try {
    const resultado = await service.crear(req.usuario, cuerpo)
    return exito(res, resultado, { http: 201 })
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

async function actualizar(req, res) {
  const { id } = idAgenteSchema.parse(req.params)
  const cuerpo = actualizarAgenteSchema.parse(req.body)

  try {
    const resultado = await service.actualizar(req.usuario, id, cuerpo)
    return exito(res, resultado)
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

async function cambiarRol(req, res) {
  const { id } = idAgenteSchema.parse(req.params)
  const { rol } = rolAgenteSchema.parse(req.params)

  try {
    const resultado = await service.cambiarRol(req.usuario, id, rol)
    return exito(res, resultado)
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

async function eliminar(req, res) {
  const { id } = idAgenteSchema.parse(req.params)

  try {
    await service.eliminar(req.usuario, id)
    return exito(res, { id })
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

module.exports = { listar, obtener, crear, actualizar, cambiarRol, eliminar }
