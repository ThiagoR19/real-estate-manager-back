const router = require("express").Router()
const { ADMIN, AGENTE, PROPIETARIO, INQUILINO } = require("../../config/roles")
const permitir = require("../../middlewares/permitir")
const controller = require("./reportes.controller")
const recibirArchivos = require("../../middlewares/archivos")
const { z } = require("zod")
const idArchivoSchema = z.coerce.number().int().positive().max(2147483647)
const service = require("./reportes.service")
const { fallo } = require("../../utils/res")
const db = require("../../db/conexion")

router.use(permitir(ADMIN, AGENTE, PROPIETARIO, INQUILINO))

router.use("/:id/archivos", async (req, res, next) => {
  try {
    const id = idArchivoSchema.parse(req.params.id)
    const entidad = await service.buscarPorId(req.usuario, id)
    if (!entidad) return fallo(res, "NO_ENCONTRADO")
    if (req.method !== "GET" && ![ADMIN, AGENTE].includes(req.usuario.rol)) {
      const [personas] = await db.execute(
        "SELECT idPersona FROM usuarios WHERE id = ? AND idInmobiliaria = ?",
        [req.usuario.id, entidad.idInmobiliaria]
      )
      if (personas[0]?.idPersona !== entidad.idPersonaReporta) return fallo(res, "SIN_PERMISO")
    }
    req.entidadArchivos = entidad
    next()
  } catch (error) { next(error) }
})
router.get("/:id/archivos", controller.listarArchivos)
router.post("/:id/archivos/documentos", recibirArchivos("documentos", { maximo: 5, megabytes: 10 }), controller.cargarDocumentos)
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
router.put("/:id", permitir(ADMIN, AGENTE), controller.actualizar)
router.delete("/:id", permitir(ADMIN, AGENTE), controller.eliminar)

module.exports = router
