const router = require("express").Router();
const { ADMIN, AGENTE } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")
const controller = require("./indec.controller")

router.use(permitir(ADMIN, AGENTE))

router.get("/", controller.listar)
router.post("/", controller.crear)

module.exports = router
