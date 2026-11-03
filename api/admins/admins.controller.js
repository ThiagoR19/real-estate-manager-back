const service = require("./admins.service")
const { exito } = require("../../utils/res")

function manejar(accion, opciones = {}) {
  return async (req, res, next) => {
    try {
      return exito(res, await accion(req), opciones)
    } catch (error) {
      return next(error)
    }
  }
}

async function listar(req, res, next) {
  try {
    const resultado = await service.listar(req.query)
    return exito(res, resultado.items, { paginacion: resultado.paginacion })
  } catch (error) {
    return next(error)
  }
}

const crear = manejar(async (req) => {
  return service.crear(req.body)
}, { http: 201 })

const eliminar = manejar(async (req) => {
  await service.eliminar(req.params.id)
  return { id: req.params.id }
})

module.exports = { listar, crear, eliminar }
