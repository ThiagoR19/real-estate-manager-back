const router = require("express").Router();

const autenticar = require("../middlewares/autenticar")

const propiedadesRouter = require("./propiedades/propiedades.router")
const authRouter = require("./auth/auth.router")
const inmobiliariasRouter = require("./inmobiliarias/inmobiliarias.router")
const inquilinosRouter = require("./inquilinos/inquilinos.router")
const agentesRouter = require("./agentes/agentes.router")
const propietariosRouter = require("./propietarios/propietarios.router")
const adminsRouter = require("./admins/admins.router")
const perfilRouter = require("./perfil/perfil.router")

router.use("/auth", authRouter)
router.use("/propiedades", propiedadesRouter)

router.use(autenticar)
router.use("/inmobiliarias",  inmobiliariasRouter)
router.use("/perfil",  perfilRouter)
router.use("/admins",  adminsRouter)
router.use("/inquilinos",  inquilinosRouter)
router.use("/agentes",  agentesRouter)
router.use("/propietarios",  propietariosRouter)



module.exports = router