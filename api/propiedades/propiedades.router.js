const router = require("express").Router();

const permitir = require("../../middlewares/permitir")
const controller = require("./propiedades.controller")

const autenticar = require("../../middlewares/autenticar")
const recibirArchivos = require("../../middlewares/archivos")
const { z } = require("zod")
const idArchivoSchema = z.coerce.number().int().positive().max(2147483647)

const service = require("./propiedades.service")
const { fallo } = require("../../utils/res")

const { ADMIN, AGENTE } = require("../../config/roles")

router.use(autenticar, permitir(ADMIN, AGENTE))
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
router.post("/:id/archivos/documentos", recibirArchivos("documentos", { maximo: 5, megabytes: 10, permitirTitulo: true }), controller.cargarDocumentos)
router.patch("/:id/archivos/documentos/:idArchivo", controller.renombrarDocumento)
router.put("/:id/archivos/documentos/:idArchivo", recibirArchivos("documentos", { megabytes: 10 }), controller.modificarDocumento)
router.get("/:id/archivos/documentos/:idArchivo", controller.descargarDocumento)
router.delete("/:id/archivos/documentos/:idArchivo", controller.eliminarDocumento)
router.post("/:id/archivos/imagenes", recibirArchivos("imagenes", { maximo: 10 }), controller.cargarImagenes)
router.put("/:id/archivos/imagenes/:idArchivo", recibirArchivos("imagenes"), controller.modificarImagen)
router.delete("/:id/archivos/imagenes/:idArchivo", controller.eliminarImagen)

router.get("/catalogos", controller.catalogos)
router.get("/", controller.listar)
router.get("/:id", controller.obtenerPorId)

router.post("/", controller.crear)
router.put("/:id", controller.actualizar)
router.delete("/:id", controller.eliminar)

module.exports = router
