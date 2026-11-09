const router = require("express").Router();
const { SUPERADMIN } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")
const controller = require("./admins.controller")
const crearRouterArchivos = require("../archivos/archivos.router")
const service = require("./admins.service")

router.use(permitir(SUPERADMIN))
router.use("/:id/archivos", crearRouterArchivos({ tipo: "persona", buscar: (_, id) => service.buscarAdmin(id), documentos: false }))

router.get("/", controller.listar)
router.post("/", controller.crear)
router.delete("/:id", controller.eliminar)

module.exports = router
