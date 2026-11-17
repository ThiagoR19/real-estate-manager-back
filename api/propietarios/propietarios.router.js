const router = require("express").Router();
const { ADMIN, AGENTE } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")
const autenticar = require("../../middlewares/autenticar")
const controller = require("./propietarios.controller")
const recibirArchivos = require("../../middlewares/archivos")
const { z } = require("zod")
const idArchivoSchema = z.coerce.number().int().positive().max(2147483647)
const service = require("./propietarios.service")
const { fallo } = require("../../utils/res")

router.use(autenticar)
router.use(permitir(ADMIN, AGENTE))
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
router.post("/:id/archivos/documentos", recibirArchivos("documentos", { maximo: 5, megabytes: 10 }), controller.cargarDocumentos)
router.put("/:id/archivos/documentos/:idArchivo", recibirArchivos("documentos", { megabytes: 10 }), controller.modificarDocumento)
router.get("/:id/archivos/documentos/:idArchivo", controller.descargarDocumento)
router.delete("/:id/archivos/documentos/:idArchivo", controller.eliminarDocumento)
router.put("/:id/archivos/foto", recibirArchivos("fotoPerfil"), controller.cargarFoto)
router.delete("/:id/archivos/foto", controller.eliminarFoto)

router.get("/", controller.listar)
router.post("/", controller.crear)
router.post("/:id/activacion", controller.generarEnlaceActivacion)
router.put("/:id", controller.actualizar)
router.delete("/:id", controller.eliminar)

module.exports = router
