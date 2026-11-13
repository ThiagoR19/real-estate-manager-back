// Antes de borrar un agente o admin, deja "sin asignar" (NULL) todo lo que apuntaba a él
// y borra lo que era solo suyo. Se usa dentro de la transacción del borrado.

// Lo asignado al agente: propiedades y visitas
async function desasignarAgente(conexion, idAgente) {
  if (!idAgente) return
  await conexion.execute("UPDATE propiedades SET idAgente = NULL WHERE idAgente = ?", [idAgente])
  await conexion.execute("UPDATE visitas SET idAgente = NULL WHERE idAgente = ?", [idAgente])
}

// Lo que referencia a la persona o a su usuario
async function desasignarPersona(conexion, { idPersona, idUsuario }) {
  if (idUsuario) {
    await conexion.execute("UPDATE versionesDocumentos SET idUsuarioAutor = NULL WHERE idUsuarioAutor = ?", [idUsuario])
  }
  await conexion.execute("UPDATE comprobantes SET idPersonaRevisora = NULL WHERE idPersonaRevisora = ?", [idPersona])

  // Chats: se conservan con el participante y el autor sin asignar
  await conexion.execute("UPDATE conversaciones SET idPersona1 = NULL WHERE idPersona1 = ?", [idPersona])
  await conexion.execute("UPDATE conversaciones SET idPersona2 = NULL WHERE idPersona2 = ?", [idPersona])
  await conexion.execute("UPDATE mensajes SET idPersona = NULL WHERE idPersona = ?", [idPersona])

  // Datos que solo tenían sentido para esa persona
  await conexion.execute("DELETE FROM conversacionesEstado WHERE idPersona = ?", [idPersona])
  await conexion.execute("DELETE FROM personasNotificaciones WHERE idPersona = ?", [idPersona])
}

module.exports = { desasignarAgente, desasignarPersona }
