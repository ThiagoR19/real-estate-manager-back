const router = require("express").Router()
const { ADMIN } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")
const controller = require("./perfil.controller")
const crearRouterArchivos = require("../archivos/archivos.router")
const service = require("./perfil.service")

router.use(permitir(ADMIN))
router.use("/archivos", crearRouterArchivos({ tipo: "persona", buscar: (_, id) => service.obtener(id), documentos: false, propio: true }))
router.get("/", controller.obtener)
router.patch("/", controller.actualizar)

module.exports = router
