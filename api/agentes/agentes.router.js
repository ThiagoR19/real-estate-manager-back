const router = require("express").Router();
const { ADMIN, SUPERADMIN } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")

router.get("/", permitir(ADMIN), (req, res) => res.sendStatus(501))
router.post("/", permitir(ADMIN), (req, res) => res.sendStatus(501))
router.put("/:id", permitir(ADMIN, SUPERADMIN), (req, res) => res.sendStatus(501))
router.delete("/:id", permitir(ADMIN, SUPERADMIN), (req, res) => res.sendStatus(501))

module.exports = router
