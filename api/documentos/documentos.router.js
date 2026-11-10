const router = require("express").Router();
const fileUpload = require("express-fileupload");
const { ADMIN, AGENTE, PROPIETARIO, INQUILINO } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")
const controller = require("./documentos.controller")

const todos = permitir(ADMIN, AGENTE, PROPIETARIO, INQUILINO)
const personal = permitir(ADMIN, AGENTE)
const recibirPdf = fileUpload({ limits: { fileSize: 10 * 1024 * 1024 } })

router.get("/", todos, controller.listar)
router.get("/:id", todos, controller.consultar)
router.get("/:id/descargar", todos, controller.descargar)
router.get("/:id/versiones/:numero/descargar", todos, controller.descargarVersion)

router.post("/", personal, recibirPdf, controller.crear)
router.post("/:id/versiones", personal, recibirPdf, controller.agregarVersion)
router.patch("/:id", personal, controller.actualizar)
router.patch("/:id/archivar", personal, controller.archivar)
router.patch("/:id/desarchivar", personal, controller.desarchivar)

module.exports = router
