const router = require("express").Router();
const fileUpload = require("express-fileupload");

const { SUPERADMIN, ADMIN } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")
const controller = require("./inmobiliarias.controller")

router.get("/mia", permitir(ADMIN), controller.consultar)
router.put("/mia", permitir(ADMIN), fileUpload({ limits: { fileSize: 2 * 1024 * 1024 }, createParentPath: true, }), controller.editar)

router.use(permitir(SUPERADMIN))

router.get("/", controller.listar)
router.post("/", controller.crear)
router.delete("/:id", controller.eliminar)
router.patch("/:id", controller.cambiarNombre)

module.exports = router
