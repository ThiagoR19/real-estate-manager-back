const router = require("express").Router();

const autenticar = require("../middlewares/autenticar")

const personasRouter = require("./personas/personas.router")
const propiedadesRouter = require("./propiedades/propiedades.router")
const authRouter = require("./auth/auth.router")
const inmobiliariasRouter = require("./inmobiliarias/inmobiliarias.router")

router.use("/auth", authRouter)
router.use("/propiedades", propiedadesRouter)

router.use("/personas", autenticar, personasRouter)
router.use("/inmobiliarias", autenticar, inmobiliariasRouter)

module.exports = router