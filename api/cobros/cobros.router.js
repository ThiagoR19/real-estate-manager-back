const router = require("express").Router();
const { ADMIN, AGENTE, PROPIETARIO } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")
const recibirArchivos = require("../../middlewares/archivos")
const controller = require("./cobros.controller")

const todos = permitir(ADMIN, AGENTE, PROPIETARIO)
const personal = permitir(ADMIN, AGENTE)
const recibirComprobante = recibirArchivos("comprobante", { megabytes: 5 })

// Estas rutas GET deben ir antes de /:id.
router.get("/propietarios", personal, controller.listarPropietarios)
router.get("/preparar", personal, controller.preparar)

router.get("/", todos, controller.listar)
router.get("/:id", todos, controller.consultar)
router.get("/:id/comprobante", todos, controller.descargarComprobante)
router.delete("/:id", permitir(ADMIN), controller.eliminar)

router.use(personal)

router.post("/", controller.crear)
router.put("/:id", controller.modificar)
router.post("/:id/comprobante", recibirComprobante, controller.cargarComprobante)
router.patch("/:id/pagado", controller.marcarPagado)

module.exports = router
