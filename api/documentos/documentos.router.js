const router = require("express").Router();
const fileUpload = require("express-fileupload");
const { ADMIN, AGENTE, PROPIETARIO, INQUILINO } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")
const controller = require("./documentos.controller")

const todos = permitir(ADMIN, AGENTE, PROPIETARIO, INQUILINO)
const recibirPdf = fileUpload({ limits: { fileSize: 10 * 1024 * 1024 } })

router.get("/", todos, controller.listar)
router.get("/:id", todos, controller.consultar)
router.get("/:id/descargar", todos, controller.descargar)
router.get("/:id/versiones/:numero/descargar", todos, controller.descargarVersion)

router.use(permitir(ADMIN, AGENTE))

router.post("/", recibirPdf, controller.crear)
router.post("/:id/versiones", recibirPdf, controller.agregarVersion)
router.patch("/:id", controller.actualizar)
router.patch("/:id/archivar", controller.archivar)
router.patch("/:id/desarchivar", controller.desarchivar)

module.exports = router
