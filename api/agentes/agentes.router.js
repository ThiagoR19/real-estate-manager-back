const router = require("express").Router();
const { ADMIN, SUPERADMIN } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")
const controller = require("./agentes.controller")
const recibirArchivos = require("../../middlewares/archivos")
const { z } = require("zod")
const idArchivoSchema = z.coerce.number().int().positive().max(2147483647)
const service = require("./agentes.service")
const { fallo } = require("../../utils/res")

router.use(permitir(ADMIN, SUPERADMIN))

router.use("/:id/archivos", async (req, res, next) => {
  try {
    const id = idArchivoSchema.parse(req.params.id)
    const entidad = await service.buscarPorId(req.usuario, id)
    if (!entidad) return fallo(res, "NO_ENCONTRADO")
    req.entidadArchivos = entidad
    next()
  } catch (error) { next(error) }
})
router.get("/:id/archivos", controller.listarArchivos)
router.put("/:id/archivos/foto", recibirArchivos("fotoPerfil"), controller.cargarFoto)
router.delete("/:id/archivos/foto", controller.eliminarFoto)
router.get("/", controller.listar)
router.get("/:id", controller.obtener)
router.post("/", controller.crear)
router.post("/:id/activacion", controller.generarEnlaceActivacion)
router.put("/:id", controller.actualizar)
router.patch("/:id/:rol", permitir(SUPERADMIN), controller.cambiarRol)
router.delete("/:id", controller.eliminar)

module.exports = router
