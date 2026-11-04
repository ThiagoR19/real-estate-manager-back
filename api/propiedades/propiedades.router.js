const router = require("express").Router();
const permitir = require("../../middlewares/permitir")
const autenticar = require("../../middlewares/autenticar")
const validar = require("../../middlewares/validar")
const controller = require("./propiedades.controller")
const { crearPropiedadSchema, actualizarPropiedadSchema, idPropiedadSchema, propiedadesQuerySchema } = require("./propiedades.schema")
const { ADMIN, AGENTE } = require("../../config/roles")

router.use(autenticar)
router.use(permitir(ADMIN, AGENTE))

router.get("/", validar(propiedadesQuerySchema, "query"), controller.listar)
router.get("/:id", validar(idPropiedadSchema, "params"), controller.obtenerPorId)

router.post("/", validar(crearPropiedadSchema), controller.crear)
router.put("/:id", validar(idPropiedadSchema, "params"), validar(actualizarPropiedadSchema), controller.actualizar)
router.delete("/:id", validar(idPropiedadSchema, "params"), controller.eliminar)

module.exports = router
