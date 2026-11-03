const router = require("express").Router();
const controller = require("./auth.controller")

router.post("/invitacion/:codigo", controller.activar)
router.post("/activar/:codigo", controller.activar)
router.post("/registro", (req, res) => res.sendStatus(501))
router.post("/login", controller.login)

module.exports = router
