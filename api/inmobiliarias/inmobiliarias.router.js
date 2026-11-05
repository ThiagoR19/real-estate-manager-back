const router = require("express").Router();
const fileUpload = require("express-fileupload");

const { SUPERADMIN, ADMIN } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")
const validar = require("../../middlewares/validar")
const {crearInmobiliariaSchema, editarInmobiliariaSchema, idInmobiliariaSchema, inmobiliariasQuerySchema} = require("./inmobiliarias.schema")
const controller = require("./inmobiliarias.controller")



router.get("/", permitir(SUPERADMIN), controller.listar)
router.post("/", permitir(SUPERADMIN), validar(crearInmobiliariaSchema, "query"), controller.crear)
router.delete("/:id", permitir(SUPERADMIN),validar(idInmobiliariaSchema, "params"), controller.eliminar)
router.get("/mia", permitir(ADMIN), controller.consultar)
router.put("/mia",permitir(ADMIN), fileUpload({limits: { fileSize: 2 * 1024 * 1024 },createParentPath: true,}),controller.editar)

module.exports = router
