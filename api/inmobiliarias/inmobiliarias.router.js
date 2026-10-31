const router = require("express").Router();
const { SUPERADMIN, ADMIN } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")

router.get("/", permitir(SUPERADMIN), (req, res) => res.sendStatus(501))
router.post("/", permitir(SUPERADMIN), (req, res) => res.sendStatus(501))
router.get("/:id", permitir(ADMIN), (req, res) => res.sendStatus(501))
router.put("/:id", permitir(ADMIN), (req, res) => res.sendStatus(501))

module.exports = router
