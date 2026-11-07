const { Server } = require("socket.io")
const { frontURL } = require("../config/env")
const { verificarToken } = require("../utils/token")
const { ERRORES } = require("../utils/res")
const registrarChat = require("./chat.socket")

let io = null

function errorSocket(codigo) {
  const err = new Error(ERRORES[codigo].mensaje)
  err.data = { codigo }
  return err
}

function autenticarSocket(socket, next) {
  const token = socket.handshake.auth?.token
  if (!token) return next(errorSocket("TOKEN_FALTANTE"))

  const datos = verificarToken(token)
  if (!datos || datos.tipo !== "Sesion") return next(errorSocket("TOKEN_INVALIDO"))

  socket.usuario = datos
  next()
}

function iniciarSocket(servidor) {
  io = new Server(servidor, {
    cors: { origin: [frontURL], methods: ["GET", "POST"] },
  })

  io.use(autenticarSocket)

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

const salaUsuario = (idUsuario) => `usuario:${idUsuario}`
const salaInmobiliaria = (idInmobi) => `inmobiliaria:${idInmobi}`
const salaConversacion = (idInmobi, idConversacion) => `conversacion:${idInmobi}:${idConversacion}`

module.exports = { iniciarSocket, obtenerIO, salaUsuario, salaInmobiliaria, salaConversacion }