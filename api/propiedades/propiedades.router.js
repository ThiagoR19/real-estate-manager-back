const router = require("express").Router();
const permitir = require("../../middlewares/permitir")
const autenticar = require("../../middlewares/autenticar")

const { ADMIN, AGENTE } = require("../../config/roles")

router.get("/", (req, res) => res.sendStatus(501))
router.get("/:id", (req, res) => res.sendStatus(501))

router.post("/", autenticar, permitir(ADMIN, AGENTE), (req, res) => res.sendStatus(501))
router.put("/:id", autenticar, permitir(ADMIN, AGENTE), (req, res) => res.sendStatus(501))
router.delete("/:id", autenticar, permitir(ADMIN, AGENTE), (req, res) => res.sendStatus(501))

module.exports = router
