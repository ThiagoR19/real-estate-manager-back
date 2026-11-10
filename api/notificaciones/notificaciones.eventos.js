const events = require("node:events")

const emisorNotificaciones = new events.EventEmitter()
const NOTIFICACION_NUEVA = "notificacion:nueva"

function emitirNotificacion({ idsUsuarios, notificacion }) {
  if (!Array.isArray(idsUsuarios) || !idsUsuarios.length) return false
  if (!notificacion || typeof notificacion !== "object") return false

  const destinatarios = [...new Set(idsUsuarios.filter((id) => Number.isInteger(id) && id > 0))]
  if (!destinatarios.length) return false

  emisorNotificaciones.emit(NOTIFICACION_NUEVA, { idsUsuarios: destinatarios, notificacion })
  return true
}

module.exports = { emisorNotificaciones, NOTIFICACION_NUEVA, emitirNotificacion }
