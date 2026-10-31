const router = require("express").Router();

router.post("/invitacion/:codigo", (req, res) => res.sendStatus(501))
router.post("/registro", (req, res) => res.sendStatus(501))
router.post("/login", (req, res) => res.sendStatus(501))

module.exports = router