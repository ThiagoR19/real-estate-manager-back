const router = require("express").Router();
const { ADMIN, AGENTE, PROPIETARIO, INQUILINO } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")
const controller = require("./contratos.controller")

const todos = permitir(ADMIN, AGENTE, PROPIETARIO, INQUILINO)
const personal = permitir(ADMIN, AGENTE)

router.get("/", todos, controller.listar)
router.get("/:id", todos, controller.consultar)
router.post("/", personal, controller.crear)
router.patch("/:id", personal, controller.modificar)
router.post("/:id/renovar", personal, controller.renovar)
router.patch("/:id/rescindir", personal, controller.rescindir)

module.exports = router
