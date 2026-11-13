const router = require("express").Router();
const { ADMIN, AGENTE } = require("../../config/roles")
const autenticar = require("../../middlewares/autenticar")
const permitir = require("../../middlewares/permitir")
const controller = require("./contVisitas.controller")

router.post("/", controller.sumar)
router.get("/", autenticar, permitir(ADMIN, AGENTE), controller.listar)

module.exports = router
