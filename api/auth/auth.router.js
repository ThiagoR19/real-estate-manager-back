const router = require("express").Router();
const controller = require("./auth.controller")
const autenticar = require("../../middlewares/autenticar")

router.post("/invitacion/:codigo", controller.activar)
router.post("/activar/:codigo", controller.activar)
router.post("/registro", (req, res) => res.sendStatus(501))
router.post("/login", controller.login)
router.post("/logout", autenticar, controller.logout)

module.exports = router
