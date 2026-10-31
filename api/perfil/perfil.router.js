const router = require("express").Router();

router.get("/", (req, res) => res.sendStatus(501))
router.patch("/", (req, res) => res.sendStatus(501))

module.exports = router