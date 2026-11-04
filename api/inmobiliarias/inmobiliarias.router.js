const router = require("express").Router();
const fileUpload = require("express-fileupload");

const { SUPERADMIN, ADMIN } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")
const controller = require("./inmobiliarias.controller")



router.get("/", permitir(SUPERADMIN), controller.listar)
router.post("/", permitir(SUPERADMIN), controller.crear)
router.delete("/:id", permitir(SUPERADMIN), controller.eliminar)
router.get("/:id", permitir(ADMIN), controller.consultar)
router.put("/:id",permitir(ADMIN), fileUpload({limits: { fileSize: 2 * 1024 * 1024 },createParentPath: true,}),controller.editar)

module.exports = router
