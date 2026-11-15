const db = require("../../db/conexion")
const ciudadesBuenosAires = require("../../db/ciudadesBuenosAires")
const { problema, limpiar, guardarLote } = require("../../utils/adjuntos")
const { crearEnlaceActivacion, crearTokenActivacion } = require("../../utils/activacion")
const { SUPERADMIN, ADMIN, AGENTE } = require("../../config/roles")
<<<<<<< HEAD
=======
const { desconectarUsuario } = require("../../sockets/sockets")
>>>>>>> develop-thiago

const SELECT_AGENTE = `
  SELECT
    a.id,
    a.idInmobiliaria,
    a.idPersona,
    a.idArea,
    ar.nombre AS zona,
    TRUE AS activo,
    u.id AS idUsuario,
    u.usuario,
    CASE
      WHEN u.fechaActivacion IS NULL THEN 'PENDIENTE_ACTIVACION'
      ELSE 'ACTIVO'
    END AS estadoCuenta,
    p.nombre,
    p.apellido,
    p.correo,
    p.dni,
    p.telefono,
    p.direccion,
    p.fotoPerfil
  FROM agentes a
  INNER JOIN personas p
    ON p.id = a.idPersona
    AND p.idInmobiliaria = a.idInmobiliaria
  INNER JOIN usuarios u
    ON u.idPersona = p.id
    AND u.idInmobiliaria = a.idInmobiliaria
  LEFT JOIN areas ar
    ON ar.id = a.idArea
    AND ar.idInmobiliaria = a.idInmobiliaria
`

function inmobiliaria(usuario, valor) {
  return usuario.rol === SUPERADMIN ? valor || null : usuario.idInmobi
}

function filtro(usuario, valor, busqueda) {
  const idInmobiliaria = inmobiliaria(usuario, valor)
  const condiciones = ["u.idRol = ?"]
  const parametros = [AGENTE]

  if (idInmobiliaria !== null) {
    condiciones.push("a.idInmobiliaria = ?")
    parametros.push(idInmobiliaria)
  }

  if (busqueda) {
    condiciones.push(`(
      p.nombre LIKE ? OR p.apellido LIKE ? OR p.correo LIKE ? OR
      p.dni LIKE ? OR u.usuario LIKE ?
    )`)
    const texto = `%${busqueda}%`
    parametros.push(texto, texto, texto, texto, texto)
  }

  return { idInmobiliaria, sql: condiciones.join(" AND "), parametros }
}

async function buscarPorId(usuario, id) {
  const condiciones = filtro(usuario)
  const [filas] = await db.execute(
    `${SELECT_AGENTE} WHERE a.id = ? AND ${condiciones.sql}`,
    [id, ...condiciones.parametros]
  )
  return incluirFotoPerfil(filas[0] || null)
}

async function listar(usuario, query = {}) {
  const condiciones = filtro(usuario, query.idInmobiliaria, query.q)
  const pagina = Number(query.page || 1)
  const limite = Number(query.limit || 10)
  const offset = (pagina - 1) * limite

  const [filas, conteo] = await Promise.all([
    db.execute(
      `${SELECT_AGENTE}
       WHERE ${condiciones.sql}
       ORDER BY p.apellido, p.nombre
       LIMIT ? OFFSET ?`,
      [...condiciones.parametros, limite, offset]
    ),
    db.execute(
      `SELECT COUNT(*) AS total
       FROM agentes a
       INNER JOIN personas p
         ON p.id = a.idPersona
         AND p.idInmobiliaria = a.idInmobiliaria
       INNER JOIN usuarios u
         ON u.idPersona = p.id
         AND u.idInmobiliaria = a.idInmobiliaria
       WHERE ${condiciones.sql}`,
      condiciones.parametros
    ),
  ])

  const total = Number(conteo[0][0].total)
  return {
    items: filas[0].map(incluirFotoPerfil),
    paginacion: { pagina, limite, total, paginas: Math.ceil(total / limite) },
  }
}

async function crear(usuario, cuerpo = {}) {
  const idInmobiliaria = inmobiliaria(usuario, cuerpo.idInmobiliaria)
  if (idInmobiliaria === null) throw problema("DATOS_INVALIDOS")
  const activacion = crearTokenActivacion()
  const conexion = await db.getConnection()

  try {
    await conexion.beginTransaction()

    const [persona] = await conexion.execute(`INSERT INTO personas (idInmobiliaria, nombre, apellido, correo, dni, telefono, direccion) VALUES (?, ?, ?, ?, ?, ?, ?)`, [idInmobiliaria, cuerpo.nombre ?? null, cuerpo.apellido ?? null, cuerpo.correo ?? null, cuerpo.dni, cuerpo.telefono ?? null, cuerpo.direccion ?? null])

    const [usuarioCreado] = await conexion.execute(`INSERT INTO usuarios (idInmobiliaria, idPersona, idRol) VALUES (?, ?, ?)`, [idInmobiliaria, persona.insertId, AGENTE])

    const [agente] = await conexion.execute(`INSERT INTO agentes (idInmobiliaria, idPersona, idArea) VALUES (?, ?, ?)`, [idInmobiliaria, persona.insertId, cuerpo.idArea ?? null])

    await conexion.execute(`INSERT INTO tokensAcceso (idUsuario, tokenHash, proposito, fechaExpiracion) VALUES (?, ?, 'ACTIVACION', ?)`, [usuarioCreado.insertId, activacion.hash, activacion.fechaExpiracion])

    await conexion.commit()
    return {
      ...(await buscarPorId({ rol: SUPERADMIN }, agente.insertId)),
      activacion: {
        codigo: activacion.codigo,
        enlace: crearEnlaceActivacion(activacion.codigo),
        expiraEn: activacion.fechaExpiracion.toISOString(),
      },
    }
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}

async function generarEnlaceActivacion(usuario, id) {
  const condiciones = filtro(usuario)
  const conexion = await db.getConnection()

  try {
    await conexion.beginTransaction()
    const [filas] = await conexion.execute(
      `SELECT u.id AS idUsuario, u.fechaActivacion
       FROM agentes a
       INNER JOIN personas p ON p.id = a.idPersona AND p.idInmobiliaria = a.idInmobiliaria
       INNER JOIN usuarios u ON u.idPersona = p.id AND u.idInmobiliaria = a.idInmobiliaria
       WHERE a.id = ? AND ${condiciones.sql}
       FOR UPDATE`,
      [id, ...condiciones.parametros]
    )

    if (!filas.length) {
      await conexion.rollback()
      return { error: "NO_ENCONTRADO" }
    }
    if (filas[0].fechaActivacion) {
      await conexion.rollback()
      return { error: "CONFLICTO" }
    }

    const activacion = crearTokenActivacion()
    await conexion.execute(
      "DELETE FROM tokensAcceso WHERE idUsuario = ? AND proposito = 'ACTIVACION'",
      [filas[0].idUsuario]
    )
    await conexion.execute(
      "INSERT INTO tokensAcceso (idUsuario, tokenHash, proposito, fechaExpiracion) VALUES (?, ?, 'ACTIVACION', ?)",
      [filas[0].idUsuario, activacion.hash, activacion.fechaExpiracion]
    )
    await conexion.commit()
    return {
      codigo: activacion.codigo,
      enlace: crearEnlaceActivacion(activacion.codigo),
      expiraEn: activacion.fechaExpiracion.toISOString(),
    }
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}

async function actualizar(usuario, id, cuerpo = {}) {
  const condiciones = filtro(usuario)
  const conexion = await db.getConnection()

  try {
    await conexion.beginTransaction()
    const [filas] = await conexion.execute(
      `SELECT a.id, a.idInmobiliaria, a.idPersona, u.id AS idUsuario
       FROM agentes a
       INNER JOIN usuarios u
         ON u.idPersona = a.idPersona
         AND u.idInmobiliaria = a.idInmobiliaria
       WHERE a.id = ? AND ${condiciones.sql}`,
      [id, ...condiciones.parametros]
    )

    if (!filas.length) {
      await conexion.rollback()
      return null
    }

    const agente = filas[0]
    const persona = {
      nombre: "nombre",
      apellido: "apellido",
      correo: "correo",
      telefono: "telefono",
      direccion: "direccion",
    }
    const cambiosPersona = Object.entries(persona).filter(([campo]) => Object.hasOwn(cuerpo, campo))

    if (cambiosPersona.length) {
      await conexion.execute(
        `UPDATE personas
         SET ${cambiosPersona.map(([, columna]) => `\`${columna}\` = ?`).join(", ")}
         WHERE id = ? AND idInmobiliaria = ?`,
        [...cambiosPersona.map(([campo]) => cuerpo[campo]), agente.idPersona, agente.idInmobiliaria]
      )
    }

    if (Object.hasOwn(cuerpo, "idArea")) {
      await conexion.execute(
        `UPDATE agentes SET idArea = ? WHERE id = ? AND idInmobiliaria = ?`,
        [cuerpo.idArea, id, agente.idInmobiliaria]
      )
    }

    await conexion.commit()
    return buscarPorId(usuario, id)
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}

async function cambiarRol(usuario, id, rol) {
  const idInmobiliaria = inmobiliaria(usuario)
  const condiciones = ["u.idRol IN (?, ?)"]
  const parametros = [AGENTE, ADMIN]
  const nuevoRol = { ADMIN, AGENTE }[String(rol).toUpperCase()] || rol

  if (idInmobiliaria !== null) {
    condiciones.push("a.idInmobiliaria = ?")
    parametros.push(idInmobiliaria)
  }

  const conexion = await db.getConnection()
  let idUsuario
  try {
    await conexion.beginTransaction()
    const [cuentas] = await conexion.execute(
      `SELECT u.id
       FROM usuarios u
       INNER JOIN agentes a
         ON a.idPersona = u.idPersona
         AND a.idInmobiliaria = u.idInmobiliaria
       WHERE a.id = ? AND ${condiciones.join(" AND ")}
       FOR UPDATE`,
      [id, ...parametros]
    )
    if (!cuentas.length) { await conexion.rollback(); return { id, rol: nuevoRol, afectados: 0 } }
    idUsuario = cuentas[0].id
    await conexion.execute("UPDATE usuarios SET idRol = ? WHERE id = ?", [nuevoRol, idUsuario])
    await conexion.commit()
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
  desconectarUsuario(idUsuario)
  return { id, rol: nuevoRol, afectados: 1 }
}

async function eliminar(usuario, id) {
  const condiciones = filtro(usuario)
  const conexion = await db.getConnection()

  try {
    await conexion.beginTransaction()
    const [filas] = await conexion.execute(
      `SELECT a.idPersona, u.id AS idUsuario, a.idInmobiliaria
       FROM agentes a
       INNER JOIN usuarios u
         ON u.idPersona = a.idPersona
         AND u.idInmobiliaria = a.idInmobiliaria
       WHERE a.id = ? AND ${condiciones.sql}`,
      [id, ...condiciones.parametros]
    )

    if (!filas.length) { await conexion.rollback(); return false }

    const agente = filas[0]
    const [documentos] = await conexion.execute(
      "SELECT 1 FROM documentos WHERE idPersona = ? AND idInmobiliaria = ? LIMIT 1",
      [agente.idPersona, agente.idInmobiliaria]
    )
    if (documentos.length) {
      throw Object.assign(new Error("No se puede eliminar porque el agente tiene documentos"), { codigo: "CONFLICTO" })
    }
    const archivosEliminar = await prepararEliminacionArchivos(conexion, agente)
    await conexion.execute("DELETE FROM tokensAcceso WHERE idUsuario = ?", [agente.idUsuario])
    await conexion.execute("DELETE FROM agentes WHERE id = ? AND idInmobiliaria = ?", [id, agente.idInmobiliaria])
    await conexion.execute("DELETE FROM usuarios WHERE id = ? AND idInmobiliaria = ?", [agente.idUsuario, agente.idInmobiliaria])
    await conexion.execute("DELETE FROM personas WHERE id = ? AND idInmobiliaria = ?", [agente.idPersona, agente.idInmobiliaria])
    await conexion.commit()
    await limpiar(archivosEliminar)
    desconectarUsuario(agente.idUsuario)
    return true
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}

async function buscarNombres(idInmobiliaria, ids) {
  if (!ids.length) {
    return []
  }
  const [filas] = await db.execute(
    `SELECT
       a.id,
       a.idPersona,
       p.nombre,
       p.apellido,
       p.fotoPerfil
     FROM agentes a
     INNER JOIN personas p
       ON p.id = a.idPersona
       AND p.idInmobiliaria = a.idInmobiliaria
     WHERE a.idInmobiliaria = ?
       AND a.id IN (${ids.map(() => "?").join(", ")})`,
    [idInmobiliaria, ...ids]
  )
  return filas.map(incluirFotoPerfil)
}

function incluirFotoPerfil(persona) {
  if (!persona) return persona
  const zona = ciudadesBuenosAires.includes(String(persona.zona || "").trim()) ? persona.zona : null
  return {
    ...persona,
    zona,
    urlFotoPerfil: persona.fotoPerfil ? `/uploads/perfiles/${persona.fotoPerfil}` : null,
  }
}

async function listarArchivos(entidad, conexion = db) {
  const [filas] = await conexion.execute(
    "SELECT fotoPerfil FROM personas WHERE id = ? AND (idInmobiliaria <=> ?)",
    [entidad.idPersona, entidad.idInmobiliaria]
  )
  if (!filas.length) throw problema("NO_ENCONTRADO")
  return { fotoPerfil: filas[0].fotoPerfil || null,
    urlFotoPerfil: filas[0].fotoPerfil ? `/uploads/perfiles/${filas[0].fotoPerfil}` : null }
}

async function cargarFoto(entidad, entradas) {
  const [nueva] = await guardarLote(entradas, "perfiles")
  let conexion
  let confirmado = false
  let anterior
  try {
    conexion = await db.getConnection()
    await conexion.beginTransaction()
    const [filas] = await conexion.execute(
      "SELECT fotoPerfil FROM personas WHERE id = ? AND (idInmobiliaria <=> ?) FOR UPDATE",
      [entidad.idPersona, entidad.idInmobiliaria]
    )
    if (!filas.length) throw problema("NO_ENCONTRADO")
    anterior = filas[0].fotoPerfil
    await conexion.execute(
      "UPDATE personas SET fotoPerfil = ? WHERE id = ? AND (idInmobiliaria <=> ?)",
      [nueva.nombre, entidad.idPersona, entidad.idInmobiliaria]
    )
    const resultado = await listarArchivos(entidad, conexion)
    await conexion.commit()
    confirmado = true
    if (anterior) await limpiar([{ destino: "perfiles", nombre: anterior }])
    return resultado
  } catch (error) {
    if (conexion && !confirmado) await conexion.rollback()
    throw error
  } finally {
    conexion?.release()
    if (!confirmado) await limpiar([nueva])
  }
}

async function eliminarFoto(entidad) {
  const conexion = await db.getConnection()
  let anterior
  try {
    await conexion.beginTransaction()
    const [filas] = await conexion.execute(
      "SELECT fotoPerfil FROM personas WHERE id = ? AND (idInmobiliaria <=> ?) FOR UPDATE",
      [entidad.idPersona, entidad.idInmobiliaria]
    )
    if (!filas.length || !filas[0].fotoPerfil) throw problema("NO_ENCONTRADO")
    anterior = filas[0].fotoPerfil
    await conexion.execute(
      "UPDATE personas SET fotoPerfil = NULL WHERE id = ? AND (idInmobiliaria <=> ?)",
      [entidad.idPersona, entidad.idInmobiliaria]
    )
    await conexion.commit()
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
  await limpiar([{ destino: "perfiles", nombre: anterior }])
}

async function prepararEliminacionArchivos(conexion, entidad) {
  const parametros = [entidad.idPersona, entidad.idInmobiliaria]
  const [personas] = await conexion.execute(
    "SELECT fotoPerfil FROM personas WHERE id = ? AND (idInmobiliaria <=> ?) FOR UPDATE", parametros
  )
  const lista = personas[0]?.fotoPerfil ? [{ destino: "perfiles", nombre: personas[0].fotoPerfil }] : []
  const [versiones] = await conexion.execute(
    `SELECT v.rutaArchivo FROM versionesDocumentos v INNER JOIN documentos d
     ON d.id = v.idDocumento AND d.idInmobiliaria = v.idInmobiliaria
     WHERE d.idPersona = ? AND d.idInmobiliaria = ?`, parametros
  )
  lista.push(...versiones.map((version) => ({ destino: "documentos", nombre: version.rutaArchivo, privado: true })))
  await conexion.execute(
    `DELETE v FROM versionesDocumentos v INNER JOIN documentos d
     ON d.id = v.idDocumento AND d.idInmobiliaria = v.idInmobiliaria
     WHERE d.idPersona = ? AND d.idInmobiliaria = ?`, parametros
  )
  await conexion.execute("DELETE FROM documentos WHERE idPersona = ? AND idInmobiliaria = ?", parametros)
  return lista
}

module.exports = { listar, buscarPorId, crear, generarEnlaceActivacion, actualizar, cambiarRol, eliminar, buscarNombres , listarArchivos, cargarFoto, eliminarFoto}
