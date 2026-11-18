const router = require("express").Router();
const { ADMIN, AGENTE, PROPIETARIO, INQUILINO } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")
const controller = require("./contratos.controller")

const todos = permitir(ADMIN, AGENTE, PROPIETARIO, INQUILINO)

router.get("/", todos, controller.listar)
router.get("/:id", todos, controller.consultar)

router.use(permitir(ADMIN, AGENTE))

router.post("/", controller.crear)
router.patch("/:id", controller.modificar)
router.post("/:id/renovar", controller.renovar)
router.patch("/:id/rescindir", controller.rescindir)

module.exports = router
