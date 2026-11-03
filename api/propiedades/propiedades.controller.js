const service = require("./propiedades.service")
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
    const resultado = await service.listar(req.propieadad, req.query)
    return exito(res, resultado.items, { paginacion: resultado.paginacion })
  } catch (error) {
    return next(error)
  }
}

const obtenerPorId = manejar(async (req) => {
  return service.buscarPorId(req.propieadad, req.params.id)
})

const crear = manejar(async (req) => {
  return service.crear(req.propieadad, req.body)
}, { http: 201 })

const actualizar = manejar(async (req) => {
  return service.actualizar(req.propieadad, req.params.id, req.body)
})

const eliminar = manejar(async (req) => {
  await service.eliminar(req.propieadad, req.params.id)
  return { id: req.params.id }
})

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar }
