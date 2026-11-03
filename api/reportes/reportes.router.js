const router = require("express").Router()
const { ADMIN, AGENTE, PROPIETARIO, INQUILINO } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")
const controller = require("./reportes.controller")

router.get("/", permitir(ADMIN, AGENTE, PROPIETARIO, INQUILINO), controller.listar)
router.get("/:id", permitir(ADMIN, AGENTE, PROPIETARIO, INQUILINO), controller.obtenerPorId)
router.post("/", permitir(ADMIN, AGENTE, PROPIETARIO, INQUILINO), controller.crear)
router.put("/:id", permitir(ADMIN, AGENTE), controller.actualizar)
router.delete("/:id", permitir(ADMIN, AGENTE), controller.eliminar)

module.exports = router
