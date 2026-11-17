const router = require("express").Router();
const { SUPERADMIN, ADMIN, AGENTE, PROPIETARIO, INQUILINO } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")
const controller = require("./notificaciones.controller")

router.use(permitir(SUPERADMIN, ADMIN, AGENTE, PROPIETARIO, INQUILINO))

router.get("/", controller.listar)
router.patch("/:id/leida", controller.actualizar)

module.exports = router
