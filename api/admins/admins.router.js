const router = require("express").Router();
const { SUPERADMIN } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")
const controller = require("./admins.controller")

router.use(permitir(SUPERADMIN))

router.get("/", controller.listar)
router.post("/", controller.crear)
router.delete("/:id", controller.eliminar)

module.exports = router
