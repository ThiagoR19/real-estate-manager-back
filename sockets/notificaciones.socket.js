const { emisorNotificaciones, NOTIFICACION_NUEVA } = require("../api/notificaciones/notificaciones.eventos")

let listenerRegistrado = null

function registrarNotificaciones(io, salaUsuario) {
  if (listenerRegistrado) {
    emisorNotificaciones.removeListener(NOTIFICACION_NUEVA, listenerRegistrado)
  }

  listenerRegistrado = ({ idsUsuarios, notificacion }) => {
    for (const idUsuario of idsUsuarios) {
      io.to(salaUsuario(idUsuario)).emit(NOTIFICACION_NUEVA, notificacion)
    }
  }

  emisorNotificaciones.on(NOTIFICACION_NUEVA, listenerRegistrado)
}

module.exports = registrarNotificaciones
