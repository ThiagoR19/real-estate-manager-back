const router = require("express").Router();
const { SUPERADMIN, ADMIN, AGENTE, PROPIETARIO, INQUILINO } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")
const controller = require("./perfil.controller")

router.use(permitir(SUPERADMIN, ADMIN, AGENTE, PROPIETARIO, INQUILINO))

router.get("/", controller.obtener)
router.patch("/", controller.actualizar)
router.patch("/contrasena", controller.cambiarContrasena)

module.exports = router
