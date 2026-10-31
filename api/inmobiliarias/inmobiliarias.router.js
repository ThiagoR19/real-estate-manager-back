const router = require("express").Router();
const { SUPERADMIN } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")

router.use(permitir(SUPERADMIN))
router.get("/inmobiliarias")