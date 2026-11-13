const router = require("express").Router()
const { z } = require("zod")
const { ADMIN, SUPERADMIN } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")
const { exito } = require("../../utils/res")
const service = require("./areas.service")

const querySchema = z.object({
  idInmobiliaria: z.coerce.number().int().positive().optional(),
}).strict()

router.get("/", permitir(ADMIN, SUPERADMIN), async (req, res, next) => {
  try {
    const { idInmobiliaria } = querySchema.parse(req.query)
    return exito(res, await service.listar(req.usuario, idInmobiliaria))
  } catch (error) { next(error) }
})

module.exports = router
