const service = require("./propiedades.service")
const { exito } = require("../../utils/res")

function entrada(req, fuente) {
  return req.validado && req.validado[fuente] !== undefined
    ? req.validado[fuente]
    : req[fuente]
}

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
    const resultado = await service.listar(req.usuario, entrada(req, "query"))
    return exito(res, resultado.items, { paginacion: resultado.paginacion })
  } catch (error) {
    return next(error)
  }
}

const obtenerPorId = manejar(async (req) => {
  return service.buscarPorId(req.usuario, entrada(req, "params").id)
})

const crear = manejar(async (req) => {
  return service.crear(req.usuario, entrada(req, "body"))
}, { http: 201 })

const actualizar = manejar(async (req) => {
  return service.actualizar(req.usuario, entrada(req, "params").id, entrada(req, "body"))
})

const eliminar = manejar(async (req) => {
  const id = entrada(req, "params").id
  await service.eliminar(req.usuario, id)
  return { id }
})

module.exports = { listar, obtenerPorId, crear, actualizar, eliminar }
