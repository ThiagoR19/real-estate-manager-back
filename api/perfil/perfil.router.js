const router = require("express").Router();
const fileUpload = require("express-fileupload")
const { SUPERADMIN, ADMIN, AGENTE, PROPIETARIO, INQUILINO } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")
const controller = require("./perfil.controller")

router.use(permitir(SUPERADMIN, ADMIN, AGENTE, PROPIETARIO, INQUILINO))

router.get("/", controller.obtener)
router.patch("/", controller.actualizar)
router.patch("/contrasena", controller.cambiarContrasena)
router.put("/foto", fileUpload({ limits: { fileSize: 2 * 1024 * 1024 } }), controller.cambiarFoto)
router.delete("/foto", controller.quitarFoto)

module.exports = router
