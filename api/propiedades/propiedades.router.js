const router = require("express").Router();
const permitir = require("../../middlewares/permitir")
const autenticar = require("../../middlewares/autenticar")
const controller = require("./propiedades.controller")
const { ADMIN, AGENTE } = require("../../config/roles")

router.use(autenticar)
router.use(permitir(ADMIN, AGENTE))

router.get("/", controller.listar)
router.get("/:id", controller.obtenerPorId)

router.post("/", controller.crear)
router.put("/:id", controller.actualizar)
router.delete("/:id", controller.eliminar)

module.exports = router
