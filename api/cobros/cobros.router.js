const router = require("express").Router();
const { ADMIN, AGENTE, PROPIETARIO } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")
const recibirArchivos = require("../../middlewares/archivos")
const controller = require("./cobros.controller")

const todos = permitir(ADMIN, AGENTE, PROPIETARIO)
const personal = permitir(ADMIN, AGENTE)
const recibirComprobante = recibirArchivos("comprobante", { megabytes: 5 })

router.get("/propietarios", personal, controller.listarPropietarios)
router.get("/preparar", personal, controller.preparar)

router.get("/", todos, controller.listar)
router.get("/:id", todos, controller.consultar)
router.get("/:id/comprobante", todos, controller.descargarComprobante)

router.post("/", personal, controller.crear)
router.put("/:id", personal, controller.modificar)
router.delete("/:id", permitir(ADMIN), controller.eliminar)

router.post("/:id/comprobante", personal, recibirComprobante, controller.cargarComprobante)
router.patch("/:id/pagado", personal, controller.marcarPagado)

module.exports = router
