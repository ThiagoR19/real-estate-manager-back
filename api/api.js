const router = require("express").Router();

const personasRouter = require("./personas/personas.router")
const propiedadesRouter = require("./propiedades/propiedades.router")
const authRouter = require("./auth/auth.router")
const inmobiliariasRouter = require("./inmobiliarias/inmobiliarias.router")

router.use("/personas",personasRouter)
router.use("/propiedades", propiedadesRouter)
router.use("/auth", authRouter)
router.use("/inmobiliarias", inmobiliariasRouter)