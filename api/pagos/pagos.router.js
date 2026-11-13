const router = require("express").Router();
const { ADMIN, AGENTE, INQUILINO } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")
const recibirArchivos = require("../../middlewares/archivos")
const controller = require("./pagos.controller")

const todos = permitir(ADMIN, AGENTE, INQUILINO)
const personal = permitir(ADMIN, AGENTE)
const recibirComprobante = recibirArchivos("comprobante", { megabytes: 5 })

router.get("/conceptos", personal, controller.listarConceptos)
router.post("/conceptos", personal, controller.crearConcepto)
router.get("/inquilinos", personal, controller.listarInquilinos)
router.get("/preparar", personal, controller.preparar)

router.get("/", todos, controller.listar)
router.get("/:id", todos, controller.consultar)
router.get("/:id/comprobante", todos, controller.descargarComprobante)

router.post("/", personal, controller.crear)
router.put("/:id", personal, controller.modificar)
router.delete("/:id", permitir(ADMIN), controller.eliminar)

router.post("/:id/comprobante", todos, recibirComprobante, controller.cargarComprobante)
router.patch("/:id/pagado", permitir(INQUILINO), controller.marcarPagado)
router.patch("/:id/aprobar", personal, controller.aprobar)
router.patch("/:id/rechazar", personal, controller.rechazar)

module.exports = router
