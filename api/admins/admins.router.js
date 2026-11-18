const router = require("express").Router();
const { SUPERADMIN } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")
const controller = require("./admins.controller")
const recibirArchivos = require("../../middlewares/archivos")
const { z } = require("zod")
const idArchivoSchema = z.coerce.number().int().positive().max(2147483647)
const service = require("./admins.service")
const { fallo } = require("../../utils/res")

router.use(permitir(SUPERADMIN))
router.use("/:id/archivos", async (req, res, next) => {
  try {
    const id = idArchivoSchema.parse(req.params.id)
    const entidad = await service.buscarAdmin(id)
    if (!entidad) return fallo(res, "NO_ENCONTRADO")
    req.entidadArchivos = entidad
    next()
  } catch (error) { next(error) }
})
router.get("/:id/archivos", controller.listarArchivos)
router.put("/:id/archivos/foto", recibirArchivos("fotoPerfil"), controller.cargarFoto)
router.delete("/:id/archivos/foto", controller.eliminarFoto)

router.get("/", controller.listar)
router.post("/", controller.crear)
router.post("/:id/activacion", controller.generarEnlaceActivacion)
router.delete("/:id", controller.eliminar)
router.patch("/:id/agente", controller.pasarAAgente)

module.exports = router
