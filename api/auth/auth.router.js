const router = require("express").Router();
const controller = require("./auth.controller")
const autenticar = require("../../middlewares/autenticar")

router.post("/invitacion/:codigo/verificar", controller.verificarDni)
router.post("/registro", controller.registrar)
router.post("/registro/google", controller.registrarGoogle)
router.post("/login", controller.login)
router.post("/login/google", controller.loginGoogle)
router.post("/logout", autenticar, controller.logout)

module.exports = router
