const service = require("./admins.service")
const { exito, fallo } = require("../../utils/res")

async function listar(req, res) {
  try {
    const resultado = await service.listar(req.query)
    return exito(res, resultado.items, { paginacion: resultado.paginacion })
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

async function crear(req, res) {
  try {
    const resultado = await service.crear(req.body)
    return exito(res, resultado, { http: 201 })
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

async function eliminar(req, res) {
  try {
    await service.eliminar(req.params.id)
    return exito(res, { id: req.params.id })
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

module.exports = { listar, crear, eliminar }
