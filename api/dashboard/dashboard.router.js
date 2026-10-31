const router = require("express").Router();
const { ADMIN, AGENTE } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")

router.use(permitir(ADMIN, AGENTE))

router.get("/", (req, res) => res.sendStatus(501))

module.exports = router
