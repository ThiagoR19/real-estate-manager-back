const router = require("express").Router();
const fileUpload = require("express-fileupload");

const { ADMIN, AGENTE, PROPIETARIO, INQUILINO } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")
const controller = require("./chats.controller")

router.use(permitir(ADMIN, AGENTE, PROPIETARIO, INQUILINO))

router.get("/", controller.listar)
router.post("/", controller.iniciar)
router.get("/contactos", controller.contactos)
router.get("/buscar", controller.buscar)
router.get("/:id/mensajes", controller.historial)
router.post("/:id/mensajes", fileUpload({ limits: { fileSize: 5 * 1024 * 1024 } }), controller.enviar)
router.patch("/:id/leida", controller.marcarLeida)
router.get("/:id/adjuntos/:idAdjunto", controller.descargarAdjunto)

module.exports = router
