const router = require("express").Router();
const { ADMIN, AGENTE, INQUILINO } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")
const recibirArchivos = require("../../middlewares/archivos")
const controller = require("./pagos.controller")

const todos = permitir(ADMIN, AGENTE, INQUILINO)
const personal = permitir(ADMIN, AGENTE)
const recibirComprobante = recibirArchivos("comprobante", { megabytes: 5 })

// Estas rutas GET deben ir antes de /:id.
router.get("/conceptos", personal, controller.listarConceptos)
router.get("/inquilinos", personal, controller.listarInquilinos)
router.get("/preparar", personal, controller.preparar)

router.get("/", todos, controller.listar)
router.get("/:id", todos, controller.consultar)
router.get("/:id/comprobante", todos, controller.descargarComprobante)
router.post("/:id/comprobante", todos, recibirComprobante, controller.cargarComprobante)
router.delete("/:id", permitir(ADMIN), controller.eliminar)
router.patch("/:id/pagado", permitir(INQUILINO), controller.marcarPagado)

router.use(personal)

router.post("/conceptos", controller.crearConcepto)
router.post("/", controller.crear)
router.put("/:id", controller.modificar)
router.patch("/:id/aprobar", controller.aprobar)
router.patch("/:id/rechazar", controller.rechazar)

module.exports = router
