const express = require("express")
const { z } = require("zod")
const recibirArchivos = require("../../middlewares/archivos")
const archivos = require("../../utils/archivos")
const { exito, fallo } = require("../../utils/res")
const { ADMIN, AGENTE } = require("../../config/roles")
const db = require("../../db/conexion")
const service = require("./archivos.service")

const idSchema = z.coerce.number().int().positive().max(2147483647)

function crearRouterArchivos({ tipo, buscar, documentos = true, propio = false }) {
  const router = express.Router({ mergeParams: true })

  router.use(async (req, res, next) => {
    const id = idSchema.parse(propio ? req.usuario.id : req.params.id)
    try {
      const entidad = await buscar(req.usuario, id)
      if (!entidad) return fallo(res, "NO_ENCONTRADO")
      if (tipo === "reporte" && ![ADMIN, AGENTE].includes(req.usuario.rol)) {
        const [personas] = await db.execute("SELECT idPersona FROM usuarios WHERE id = ? AND idInmobiliaria = ?", [req.usuario.id, entidad.idInmobiliaria])
        if (personas[0]?.idPersona !== entidad.idPersonaReporta) return fallo(res, "SIN_PERMISO")
      }
      req.entidadArchivos = entidad
      next()
    } catch (error) { next(error) }
  })

  router.get("/", async (req, res, next) => {
    try { return exito(res, await service.listar(tipo, req.entidadArchivos)) }
    catch (error) { next(error) }
  })

  function cargar(clase) {
    return async (req, res, next) => {
      try {
        const resultado = await service.cargar(tipo, req.entidadArchivos, clase, req.archivos, req.usuario.id)
        return exito(res, resultado, { http: clase === "foto" ? 200 : 201 })
      } catch (error) {
        if (error.codigo) return fallo(res, error.codigo)
        next(error)
      }
    }
  }

  function eliminar(clase) {
    return async (req, res, next) => {
      const idArchivo = clase === "foto" ? undefined : idSchema.parse(req.params.idArchivo)
      try {
        await service.eliminar(tipo, req.entidadArchivos, clase, idArchivo)
        return exito(res, null)
      } catch (error) {
        if (error.codigo) return fallo(res, error.codigo)
        next(error)
      }
    }
  }

  if (tipo === "persona") {
    router.put("/foto", recibirArchivos("fotoPerfil"), cargar("foto"))
    router.delete("/foto", eliminar("foto"))
  } else {
    router.post("/imagenes", recibirArchivos("imagenes", { maximo: 10 }), cargar("imagenes"))
    router.delete("/imagenes/:idArchivo", eliminar("imagenes"))
  }

  if (documentos) {
    router.post("/documentos", recibirArchivos("documentos", { maximo: 5, megabytes: 10 }), cargar("documentos"))
    router.get("/documentos/:idArchivo", async (req, res, next) => {
      const idArchivo = idSchema.parse(req.params.idArchivo)
      try {
        const [documento] = await service.buscarDocumento(tipo, req.entidadArchivos, idArchivo)
        if (!documento) return fallo(res, "NO_ENCONTRADO")
        res.download(archivos.rutaArchivo("documentos", documento.rutaArchivo, true), documento.nombreArchivo, (error) => {
          if (!error) return
          if (res.headersSent) return next(error)
          if (error.code === "ENOENT") return fallo(res, "NO_ENCONTRADO")
          next(error)
        })
      } catch (error) { next(error) }
    })
    router.delete("/documentos/:idArchivo", eliminar("documentos"))
  }
  return router
}

module.exports = crearRouterArchivos
