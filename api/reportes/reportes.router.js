const router = require("express").Router()
const { ADMIN, AGENTE, PROPIETARIO, INQUILINO } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")
const controller = require("./reportes.controller")

router.use(permitir(ADMIN, AGENTE, PROPIETARIO, INQUILINO))

router.get("/", controller.listar)
router.get("/:id", controller.obtenerPorId)
router.post("/", controller.crear)
router.put("/:id", permitir(ADMIN, AGENTE), controller.actualizar)
router.delete("/:id", permitir(ADMIN, AGENTE), controller.eliminar)

module.exports = router
