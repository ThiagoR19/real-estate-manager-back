const { Server } = require("socket.io")
const { frontURL } = require("../config/env")
const { validarSesion } = require("../middlewares/autenticar")
const { ERRORES } = require("../utils/res")
const registrarChat = require("./chat.socket")
const registrarNotificaciones = require("./notificaciones.socket")

let io = null

function errorSocket(codigo) {
  const err = new Error(ERRORES[codigo].mensaje)
  err.data = { codigo }
  return err
}

async function autenticarSocket(socket, next) {
  const token = socket.handshake.auth?.token
  if (!token) {
    return next(errorSocket("TOKEN_FALTANTE"))
  }

  try {
    const usuario = await validarSesion(token)
    if (!usuario) return next(errorSocket("TOKEN_INVALIDO"))
    socket.usuario = usuario
    socket.use(async (_paquete, continuar) => {
      try {
        const vigente = await validarSesion(token)
        if (!vigente) {
          socket.disconnect(true)
          return continuar(errorSocket("TOKEN_INVALIDO"))
        }
        socket.usuario = vigente
        continuar()
      } catch (error) {
        continuar(error)
      }
    })
    next()
  } catch (error) {
    next(error)
  }
}

function iniciarSocket(servidor) {
  io = new Server(servidor, {
    cors: { origin: [frontURL], methods: ["GET", "POST"] },
  })

  io.use(autenticarSocket)
  registrarNotificaciones(io, salaUsuario)

  io.on("connection", (socket) => {
    const { id, idInmobi } = socket.usuario

    socket.join(salaUsuario(id))
    if (idInmobi) socket.join(salaInmobiliaria(idInmobi))

    registrarChat(io, socket)
  })

  return io
}

function obtenerIO() {
  if (!io) throw new Error("socket.io no fue inicializado")
  return io
}

function desconectarUsuario(idUsuario) {
  if (!io) return
  try {
    io.in(salaUsuario(idUsuario)).disconnectSockets(true)
  } catch (error) {
    console.error("No se pudo desconectar al usuario", idUsuario, error)
  }
}

const salaUsuario = (idUsuario) => `usuario:${idUsuario}`
const salaInmobiliaria = (idInmobi) => `inmobiliaria:${idInmobi}`
const salaConversacion = (idInmobi, idConversacion) => `conversacion:${idInmobi}:${idConversacion}`

module.exports = { iniciarSocket, obtenerIO, desconectarUsuario, salaUsuario, salaInmobiliaria, salaConversacion }
