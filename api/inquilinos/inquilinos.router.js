const router = require("express").Router();

const { ADMIN, AGENTE } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")
const controller = require("./inquilinos.controller")

router.use(permitir(ADMIN, AGENTE))

router.get("/", controller.listar)
router.get("/:id", controller.obtener)
router.post("/", controller.crear)
router.put("/:id", controller.actualizar)
router.delete("/:id", controller.eliminar)

module.exports = router
