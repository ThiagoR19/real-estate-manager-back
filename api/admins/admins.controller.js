 const service = require("./admins.service")
const {
  adminsQuerySchema,
  crearAdminSchema,
  idAdminSchema,
} = require("./admins.schema")
const { exito, fallo } = require("../../utils/res")

async function listar(req, res) {
  const query = adminsQuerySchema.parse(req.query)

  try {
    const resultado = await service.listar(query)
    return exito(res, resultado.items, { paginacion: resultado.paginacion })
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

async function crear(req, res) {
  const cuerpo = crearAdminSchema.parse(req.body)

  try {
    const resultado = await service.crear(cuerpo)
    return exito(res, resultado, { http: 201 })
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

async function eliminar(req, res) {
  const { id } = idAdminSchema.parse(req.params)

  try {
    await service.eliminar(id)
    return exito(res, { id })
  } catch (error) {
    return fallo(res, "ERROR_INTERNO")
  }
}

module.exports = { listar, crear, eliminar }
