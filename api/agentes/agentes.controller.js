const service = require("./agentes.service")
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
    const resultado = await service.listar(req.usuario, req.query)
    return exito(res, resultado.items, { paginacion: resultado.paginacion })
  } catch (error) {
    return next(error)
  }
}

const obtener = manejar(async (req) => {
  return service.buscarPorId(req.usuario, req.params.id)
})

const crear = manejar(async (req) => {
  return service.crear(req.usuario, req.body)
}, { http: 201 })

const actualizar = manejar(async (req) => {
  return service.actualizar(req.usuario, req.params.id, req.body)
})

const cambiarRol = manejar(async (req) => {
  return service.cambiarRol(req.usuario, req.params.id, req.params.rol)
})

const eliminar = manejar(async (req) => {
  await service.eliminar(req.usuario, req.params.id)
  return { id: req.params.id }
})

module.exports = { listar, obtener, crear, actualizar, cambiarRol, eliminar }
