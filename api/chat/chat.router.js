const router = require("express").Router();
const { ADMIN, AGENTE, PROPIETARIO, INQUILINO } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")

router.use(permitir(ADMIN, AGENTE, PROPIETARIO, INQUILINO))

router.get("/", (req, res) => res.sendStatus(501))
router.post("/", (req, res) => res.sendStatus(501))
router.get("/:id/mensajes", (req, res) => res.sendStatus(501))
router.post("/:id/mensajes", (req, res) => res.sendStatus(501))

module.exports = router
