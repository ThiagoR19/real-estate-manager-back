const router = require("express").Router();
const { SUPERADMIN } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")

router.use(permitir(SUPERADMIN))
router.get("/", (req, res) => res.sendStatus(501))
router.post("/", (req, res) => res.sendStatus(501))
router.put("/:id", (req, res) => res.sendStatus(501))
router.delete("/:id", (req, res) => res.sendStatus(501))

module.exports = router