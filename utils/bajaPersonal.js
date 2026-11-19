const REFERENCIADA = ["ER_ROW_IS_REFERENCED_2", "ER_ROW_IS_REFERENCED"]

async function darDeBajaPersonal(conexion, { idUsuario, idPersona, idInmobiliaria }) {
  await conexion.execute(
    "UPDATE versionesDocumentos SET idUsuarioAutor = NULL WHERE idUsuarioAutor = ? AND idInmobiliaria <=> ?",
    [idUsuario, idInmobiliaria]
  )

  const [agentes] = await conexion.execute(
    "SELECT id FROM agentes WHERE idPersona = ? AND idInmobiliaria <=> ?",
    [idPersona, idInmobiliaria]
  )
  for (const agente of agentes) {
    await conexion.execute(
      "UPDATE propiedades SET idAgente = NULL WHERE idAgente = ? AND idInmobiliaria <=> ?",
      [agente.id, idInmobiliaria]
    )
    await conexion.execute(
      "UPDATE visitas SET idAgente = NULL WHERE idAgente = ? AND idInmobiliaria <=> ?",
      [agente.id, idInmobiliaria]
    )
  }

  await conexion.execute("DELETE FROM tokensAcceso WHERE idUsuario = ?", [idUsuario])
  await conexion.execute("DELETE FROM agentes WHERE idPersona = ? AND idInmobiliaria <=> ?", [idPersona, idInmobiliaria])
  await conexion.execute("DELETE FROM usuarios WHERE id = ? AND idInmobiliaria <=> ?", [idUsuario, idInmobiliaria])

  await conexion.query("SAVEPOINT baja_personal")
  try {
    await conexion.execute("DELETE FROM personas WHERE id = ? AND idInmobiliaria <=> ?", [idPersona, idInmobiliaria])
    await conexion.query("RELEASE SAVEPOINT baja_personal")
    return true
  } catch (error) {
    if (!REFERENCIADA.includes(error.code)) throw error
    await conexion.query("ROLLBACK TO SAVEPOINT baja_personal")
    await conexion.execute(
      "UPDATE personas SET dni = NULL, correo = NULL WHERE id = ? AND idInmobiliaria <=> ?",
      [idPersona, idInmobiliaria]
    )
    return false
  }
}

function archivosABorrar(archivos, personaEliminada) {
  return personaEliminada ? archivos : archivos.filter((archivo) => archivo.destino !== "perfiles")
}

module.exports = { darDeBajaPersonal, archivosABorrar }
