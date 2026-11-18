const router = require("express").Router();
const { ADMIN, AGENTE, PROPIETARIO, INQUILINO } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")
const controller = require("./notificaciones.controller")

router.use(permitir(ADMIN, AGENTE, PROPIETARIO, INQUILINO))

router.get("/", controller.listar)
router.patch("/:id/leida", controller.actualizar)

module.exports = router
