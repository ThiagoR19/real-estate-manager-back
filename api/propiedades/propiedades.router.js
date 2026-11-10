const router = require("express").Router();

const permitir = require("../../middlewares/permitir")
const controller = require("./propiedades.controller")

const autenticar = require("../../middlewares/autenticar")
const crearRouterArchivos = require("../archivos/archivos.router")

const service = require("./propiedades.service")

const { ADMIN, AGENTE } = require("../../config/roles")

router.use(autenticar, permitir(ADMIN, AGENTE))
router.use("/:id/archivos", crearRouterArchivos({ tipo: "propiedad", buscar: service.buscarPorId }))

router.get("/catalogos", controller.catalogos)
router.get("/", controller.listar)
router.get("/:id", controller.obtenerPorId)

router.post("/", controller.crear)
router.put("/:id", controller.actualizar)
router.delete("/:id", controller.eliminar)

module.exports = router
