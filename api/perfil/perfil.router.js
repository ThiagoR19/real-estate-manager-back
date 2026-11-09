const router = require("express").Router()
const { ADMIN } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")
const controller = require("./perfil.controller")

router.use(permitir(ADMIN))
router.get("/", controller.obtener)
router.patch("/", controller.actualizar)

module.exports = router
