const router = require("express").Router()
const { ADMIN, AGENTE, PROPIETARIO, INQUILINO } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")
const controller = require("./reportes.controller")
const crearRouterArchivos = require("../archivos/archivos.router")
const service = require("./reportes.service")

router.use(permitir(ADMIN, AGENTE, PROPIETARIO, INQUILINO))

router.use("/:id/archivos", crearRouterArchivos({ tipo: "reporte", buscar: service.buscarPorId, documentos: false }))
router.get("/", controller.listar)
router.get("/:id", controller.obtenerPorId)
router.post("/", controller.crear)
router.put("/:id", permitir(ADMIN, AGENTE), controller.actualizar)
router.delete("/:id", permitir(ADMIN, AGENTE), controller.eliminar)

module.exports = router
