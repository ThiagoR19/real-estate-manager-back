const router = require("express").Router();
const { ADMIN, SUPERADMIN } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")
const controller = require("./agentes.controller")

router.use(permitir(ADMIN, SUPERADMIN))

router.get("/", controller.listar)
router.get("/:id", controller.obtener)
router.post("/", controller.crear)
router.put("/:id", controller.actualizar)
router.patch("/:id/:rol", permitir(SUPERADMIN), controller.cambiarRol)
router.delete("/:id", controller.eliminar)

module.exports = router
