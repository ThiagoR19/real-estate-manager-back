const router = require("express").Router();
const { ADMIN, AGENTE, SUPERADMIN } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")

router.get("/propiedades")
router.get("/propiedades/:id")

router.use(permitir(ADMIN, AGENTE))
router.post("/propiedades")
router.put("/propiedades/:id")
router.delete("/propiedades/:id")

