const router = require("express").Router();
const { ADMIN, AGENTE } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")
const controller = require("./visitas.controller")

router.get("/", permitir(ADMIN, AGENTE), controller.listar)
router.get("/:id", permitir(ADMIN, AGENTE), controller.consultar)
router.post("/", permitir(AGENTE), controller.programar)
router.put("/:id", permitir(AGENTE), controller.modificar)
router.patch("/:id/cancelar", permitir(AGENTE), controller.cancelar)

module.exports = router
