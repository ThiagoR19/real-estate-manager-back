const router = require("express").Router();
const { ADMIN, AGENTE } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")
const controller = require("./visitas.controller")

router.get("/", permitir(ADMIN, AGENTE), controller.listar)
router.get("/clientes", permitir(ADMIN, AGENTE), controller.listarClientes)
router.get("/:id", permitir(ADMIN, AGENTE), controller.consultar)

router.use(permitir(AGENTE))

router.post("/clientes", controller.crearCliente)
router.post("/", controller.programar)
router.put("/:id", controller.modificar)
router.patch("/:id/cancelar", controller.cancelar)

module.exports = router
