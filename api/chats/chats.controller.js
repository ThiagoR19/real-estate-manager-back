const path = require("path")
const { exito, fallo } = require("../../utils/res")
const archivos = require("../../utils/archivos")
const service = require("./chats.service")
const { obtenerIO, salaUsuario, salaConversacion } = require("../../sockets/sockets")
const { emitirNotificacion } = require("../notificaciones/notificaciones.eventos")
const { idConversacionSchema, idAdjuntoSchema, iniciarConversacionSchema, enviarMensajeSchema, conversacionesQuerySchema, contactosQuerySchema, historialQuerySchema, buscarQuerySchema } = require("./chats.schema")

const DESTINO_ADJUNTOS = "chats"
const MAX_ADJUNTOS = 5
const CARPETA_UPLOADS = path.join(__dirname, "../../uploads")

function nombreOriginal(archivo, nombreGuardado) {
  const base = path.parse(String(archivo.name || "archivo")).name.replace(/[^\p{L}\p{N} ._-]/gu, "").slice(0, 200) || "archivo"
  return `${base}${path.extname(nombreGuardado)}`
}

function emitir(sala, evento, datos) {
  try {
    obtenerIO().to(sala).emit(evento, datos)
  } catch (error) {
    console.error(error)
  }
}

function avisarMensaje(req, resultado) {
  const { mensaje, destinatario } = resultado
  emitir(salaConversacion(req.usuario.idInmobi, mensaje.idConversacion), "chat:mensaje", mensaje)
  if (destinatario) {
    emitir(salaUsuario(destinatario.idUsuario), "chat:actualizada", { idConversacion: mensaje.idConversacion, mensaje })
    emitirNotificacion({
      idsUsuarios: [destinatario.idUsuario],
      notificacion: {
        id: `chat:${mensaje.id}`,
        tipo: "chat",
        titulo: "Nuevo mensaje",
        contenido: mensaje.contenido || "Te enviaron un archivo adjunto",
        fechaCreacion: mensaje.fecha,
        idConversacion: mensaje.idConversacion,
      },
    })
  }
}

async function listar(req, res, next) {
  const filtros = conversacionesQuerySchema.parse(req.query)

  try {
    const datos = await service.listar(req.usuario.id, filtros)
    return exito(res, datos)
  }
  catch (error) {
    return next(error)
  }
}

async function contactos(req, res, next) {
  const filtros = contactosQuerySchema.parse(req.query)

  try {
    const datos = await service.contactos(req.usuario.id, filtros)
    return exito(res, datos)
  }
  catch (error) {
    return next(error)
  }
}

async function buscar(req, res, next) {
  const filtros = buscarQuerySchema.parse(req.query)

  try {
    const datos = await service.buscar(req.usuario.id, filtros)
    return exito(res, datos)
  }
  catch (error) {
    return next(error)
  }
}

async function iniciar(req, res, next) {
  const cuerpo = iniciarConversacionSchema.parse(req.body)

  try {
    const resultado = await service.iniciar(req.usuario.id, cuerpo)
    if (resultado.error) {
      return fallo(res, resultado.error, { mensaje: resultado.mensaje })
    }

    avisarMensaje(req, resultado)
    return exito(res, { conversacion: resultado.conversacion, mensaje: resultado.mensaje }, { http: resultado.creada ? 201 : 200 })
  }
  catch (error) {
    return next(error)
  }
}

async function historial(req, res, next) {
  const { id } = idConversacionSchema.parse(req.params)
  const query = historialQuerySchema.parse(req.query)

  try {
    const resultado = await service.historial(req.usuario.id, id, query)
    if (!resultado) {
      return fallo(res, "NO_ENCONTRADO", { mensaje: "La conversación no existe" })
    }
    return exito(res, resultado.items, { paginacion: resultado.paginacion })
  }
  catch (error) {
    return next(error)
  }
}

async function enviar(req, res, next) {
  const { id } = idConversacionSchema.parse(req.params)
  const { contenido } = enviarMensajeSchema.parse(req.body ?? {})

  const recibidos = req.files?.adjunto
  const lista = recibidos ? [].concat(recibidos) : []

  if (!contenido && !lista.length) {
    return fallo(res, "DATOS_INVALIDOS", { mensaje: "Debe enviar un mensaje o un archivo" })
  }
  if (lista.length > MAX_ADJUNTOS) {
    return fallo(res, "DATOS_INVALIDOS", { mensaje: `Puede enviar hasta ${MAX_ADJUNTOS} archivos por mensaje` })
  }

  try {
    const participa = await service.esParticipante(req.usuario, id, req.usuario.idInmobi)
    if (!participa) {
      return fallo(res, "NO_ENCONTRADO", { mensaje: "La conversación no existe" })
    }

    const adjuntos = []
    for (const archivo of lista) {
      const guardado = await archivos(archivo, DESTINO_ADJUNTOS, ["imagen", "pdf"])
      if (guardado.codigo !== "EXITO") {
        if (guardado.error) {
          console.error(guardado.error)
        }
        return fallo(res, guardado.codigo)
      }
      adjuntos.push({
        nombreArchivo: nombreOriginal(archivo, guardado.nombre),
        rutaArchivo: `${DESTINO_ADJUNTOS}/${guardado.nombre}`,
        mimeType: guardado.mimeType,
        tamanioBytes: guardado.tamanioBytes,
      })
    }

    const resultado = await service.enviar(req.usuario.id, id, { contenido, adjuntos })
    if (resultado.error) {
      return fallo(res, resultado.error, { mensaje: resultado.mensaje })
    }

    avisarMensaje(req, resultado)
    return exito(res, resultado.mensaje, { http: 201 })
  }
  catch (error) {
    return next(error)
  }
}

async function marcarLeida(req, res, next) {
  const { id } = idConversacionSchema.parse(req.params)

  try {
    const conversacion = await service.marcarLeida(req.usuario.id, id)
    if (!conversacion) {
      return fallo(res, "NO_ENCONTRADO", { mensaje: "La conversación no existe" })
    }

    emitir(salaConversacion(req.usuario.idInmobi, id), "chat:leida", {
      idConversacion: id,
      idUsuario: req.usuario.id,
      fechaUltimaLectura: conversacion.fechaUltimaLectura,
    })
    return exito(res, conversacion)
  }
  catch (error) {
    return next(error)
  }
}

async function descargarAdjunto(req, res, next) {
  const { id, idAdjunto } = idAdjuntoSchema.parse(req.params)

  try {
    const adjunto = await service.obtenerAdjunto(req.usuario.id, id, idAdjunto)
    if (!adjunto) {
      return fallo(res, "NO_ENCONTRADO", { mensaje: "El archivo no existe" })
    }

    const ruta = path.resolve(CARPETA_UPLOADS, adjunto.rutaArchivo)
    if (!ruta.startsWith(CARPETA_UPLOADS + path.sep)) {
      return fallo(res, "NO_ENCONTRADO", { mensaje: "El archivo no existe" })
    }

    res.set("X-Content-Type-Options", "nosniff")
    res.type(adjunto.mimeType || "application/octet-stream")
    return res.download(ruta, adjunto.nombreArchivo, (error) => {
      if (error && !res.headersSent) {
        return fallo(res, "NO_ENCONTRADO", { mensaje: "El archivo no existe" })
      }
      if (error) {
        console.error(error)
      }
    })
  }
  catch (error) {
    return next(error)
  }
}

module.exports = { listar, contactos, buscar, iniciar, historial, enviar, marcarLeida, descargarAdjunto }
