const router = require("express").Router();
const fileUpload = require("express-fileupload");
const { ADMIN, AGENTE, PROPIETARIO, INQUILINO } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")
const controller = require("./contratos.controller")

const todos = permitir(ADMIN, AGENTE, PROPIETARIO, INQUILINO)
const personal = permitir(ADMIN, AGENTE)

router.get("/", todos, controller.listar)
router.get("/:id", todos, controller.consultar)
router.get("/:id/documentos/:idDocumento", todos, controller.descargarDocumento)
router.post("/", personal, controller.crear)
router.patch("/:id", personal, controller.modificar)
router.post("/:id/renovar", personal, controller.renovar)
router.patch("/:id/rescindir", personal, controller.rescindir)
router.post("/:id/documentos", personal, fileUpload({ limits: { fileSize: 10 * 1024 * 1024 } }), controller.subirDocumento)

module.exports = router
