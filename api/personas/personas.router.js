const router = require("express").Router();
const { ADMIN, AGENTE, SUPERADMIN } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")

router.use(permitir(SUPERADMIN, ADMIN, AGENTE))

router.get("/agentes", permitir(ADMIN, SUPERADMIN), (req, res) => res.sendStatus(501))
router.post("/agentes", permitir(ADMIN, SUPERADMIN), (req, res) => res.sendStatus(501))
router.put("/agentes/:id", permitir(ADMIN, SUPERADMIN), (req, res) => res.sendStatus(501))
router.delete("/agentes/:id", permitir(ADMIN, SUPERADMIN), (req, res) => res.sendStatus(501))

router.get("/inquilinos", (req, res) => res.sendStatus(501))
router.post("/inquilinos", (req, res) => res.sendStatus(501))
router.put("/inquilinos/:id", (req, res) => res.sendStatus(501))
router.delete("/inquilinos/:id",(req, res) => res.sendStatus(501))

router.get("/propietarios",(req, res) => res.sendStatus(501))
router.post("/propietarios",(req, res) => res.sendStatus(501))
router.put("/propietarios/:id",(req, res) => res.sendStatus(501))
router.delete("/propietarios/:id",(req, res) => res.sendStatus(501))

module.exports = router