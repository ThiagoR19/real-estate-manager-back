const { z } = require("zod")
const { ERRORES } = require("../utils/res")
const { ADMIN, AGENTE, PROPIETARIO, INQUILINO } = require("../config/roles")
const chatsService = require("../api/chats/chats.service")

const idConversacionSchema = z.object({ idConversacion: z.coerce.number().int().positive(), }).strict()

const ROLES_CHAT = [ADMIN, AGENTE, PROPIETARIO, INQUILINO]

function responderFallo(ack, codigo) {
  if (typeof ack !== "function") return
  const definido = ERRORES[codigo] || ERRORES.ERROR_INTERNO
  ack({ status: definido.http >= 500 ? "error" : "fail", error: { codigo, mensaje: definido.mensaje } })
}

function registrarChat(io, socket) {
  const { salaConversacion } = require("./sockets")

  socket.on("chat:unirse", async (datos, ack) => {
    try {
      if (!ROLES_CHAT.includes(socket.usuario.rol)) {
        return responderFallo(ack, "SIN_PERMISO")
      }

      const resultado = idConversacionSchema.safeParse(datos)
      if (!resultado.success) {
        return responderFallo(ack, "DATOS_INVALIDOS")
      }

      const { idConversacion } = resultado.data
      const participa = await chatsService.esParticipante(socket.usuario, idConversacion, socket.usuario.idInmobi)
      if (!participa) {
        return responderFallo(ack, "NO_ENCONTRADO")
      }

      socket.join(salaConversacion(socket.usuario.idInmobi, idConversacion))
      if (typeof ack === "function") {
        ack({ status: "success", data: { idConversacion } })
      }
    } catch (error) {
      console.error(error)
      responderFallo(ack, "ERROR_INTERNO")
    }
  })

  socket.on("chat:salir", (datos) => {
    const resultado = idConversacionSchema.safeParse(datos)
    if (!resultado.success) return
    socket.leave(salaConversacion(socket.usuario.idInmobi, resultado.data.idConversacion))
  })
}

module.exports = registrarChat
