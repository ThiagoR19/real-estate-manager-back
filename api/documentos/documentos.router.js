const router = require("express").Router();
const { ADMIN, AGENTE, PROPIETARIO, INQUILINO } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")

router.get("/", permitir(ADMIN, AGENTE, PROPIETARIO, INQUILINO), (req, res) => res.sendStatus(501))
router.get("/:id", permitir(ADMIN, AGENTE, PROPIETARIO, INQUILINO), (req, res) => res.sendStatus(501))

router.post("/", permitir(ADMIN, AGENTE), (req, res) => res.sendStatus(501))
router.put("/:id", permitir(ADMIN, AGENTE), (req, res) => res.sendStatus(501))
router.delete("/:id", permitir(ADMIN, AGENTE), (req, res) => res.sendStatus(501))

module.exports = router
