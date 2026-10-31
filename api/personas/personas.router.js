const router = require("express").Router();
const { ADMIN, AGENTE, SUPERADMIN } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")

router.use(permitir(SUPERADMIN, ADMIN, AGENTE))

router.get("/agentes", permitir(ADMIN, SUPERADMIN))
router.post("/agentes", permitir(ADMIN, SUPERADMIN))
router.put("/agentes/:id", permitir(ADMIN, SUPERADMIN))
router.delete("/agentes/:id", permitir(ADMIN, SUPERADMIN))

router.get("/inquilinos",)
router.post("/inquilinos")
router.put("/inquilinos/:id")
router.delete("/inquilinos/:id")

router.get("/propietarios")
router.post("/propietarios")
router.put("/propietarios/:id")
router.delete("/propietarios/:id")
