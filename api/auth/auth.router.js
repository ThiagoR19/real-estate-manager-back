const router = require("express").Router();
const controller = require("./auth.controller")
const autenticar = require("../../middlewares/autenticar")
const { limitarLogin, limitarVerificacion } = require("../../middlewares/limitarIntentos")

router.post("/invitacion/:codigo/verificar", limitarVerificacion, controller.verificarDni)
router.post("/registro", controller.registrar)
router.post("/registro/google", controller.registrarGoogle)
router.post("/login", limitarLogin, controller.login)
router.post("/login/google", controller.loginGoogle)
router.post("/logout", autenticar, controller.logout)

module.exports = router
