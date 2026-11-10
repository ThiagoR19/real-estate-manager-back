const router = require("express").Router();

const { ADMIN, AGENTE } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")
const controller = require("./inquilinos.controller")
const crearRouterArchivos = require("../archivos/archivos.router")
const service = require("./inquilinos.service")

router.use(permitir(ADMIN, AGENTE))
router.use("/:id/archivos", crearRouterArchivos({ tipo: "persona", buscar: service.buscarPorId, documentos: false }))

router.get("/", controller.listar)
router.get("/:id", controller.obtener)
router.post("/", controller.crear)
router.put("/:id", controller.actualizar)
router.delete("/:id", controller.eliminar)

module.exports = router
