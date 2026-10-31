const router = require("express").Router();

const personasRouter = require("./personas/personas.router")
const propiedadesRouter = require("./propiedades/propiedades.router")
const authRouter = require("./auth/auth.router")

router.use("/personas")
router.use("/propiedades")
router.use("/auth")