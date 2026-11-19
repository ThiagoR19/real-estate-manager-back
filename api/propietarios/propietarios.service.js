const db = require("../../db/conexion")
const { limpiar, guardarLote } = require("../../utils/adjuntos")
const { problema } = require("../../utils/res")
const { crearEnlaceActivacion, crearTokenActivacion } = require("../../utils/activacion")
const { SUPERADMIN, PROPIETARIO } = require("../../config/roles")
const { desconectarUsuario } = require("../../sockets/sockets")
const { avisarAlta } = require("../notificaciones/notificaciones.cuentas")

const SELECT_PROPIETARIO = `
  SELECT
    pr.id,
    pr.idInmobiliaria,
    pr.idPersona,
    pr.cbu,
    pr.alias,
    pr.activo,
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
  FROM propietarios pr
  INNER JOIN personas p
    ON p.id = pr.idPersona
    AND p.idInmobiliaria = pr.idInmobiliaria
  INNER JOIN usuarios u
    ON u.idPersona = p.id
    AND u.idInmobiliaria = pr.idInmobiliaria
`

function alcance(usuario, valor) {
  if (usuario?.rol === SUPERADMIN) {
    return valor ?? null
  }

  if (usuario?.idInmobi === undefined || usuario.idInmobi === null) {
    throw new Error("La inmobiliaria del usuario es obligatoria")
  }

  return usuario.idInmobi
}

function tiene(cuerpo, campo) {
  return Object.prototype.hasOwnProperty.call(cuerpo, campo)
}

function filtro(usuario, valorInmobiliaria, busqueda) {
  const idInmobiliaria = alcance(usuario, valorInmobiliaria)
  const condiciones = ["u.idRol = ?"]
  const parametros = [PROPIETARIO]

  if (idInmobiliaria !== null) {
    condiciones.push("pr.idInmobiliaria = ?")
    parametros.push(idInmobiliaria)
  }

  if (busqueda) {
    condiciones.push(`(
      p.nombre LIKE ? OR p.apellido LIKE ? OR p.correo LIKE ? OR
      p.dni LIKE ? OR p.telefono LIKE ? OR u.usuario LIKE ? OR
      pr.cbu LIKE ? OR pr.alias LIKE ?
    )`)
    const texto = `%${busqueda}%`
    parametros.push(texto, texto, texto, texto, texto, texto, texto, texto)
  }

  return { idInmobiliaria, sql: condiciones.join(" AND "), parametros }
}

async function buscarPorIdConConexion(usuario, id, conexion) {
  const condiciones = filtro(usuario)
  const [filas] = await conexion.execute(
    `${SELECT_PROPIETARIO} WHERE pr.id = ? AND ${condiciones.sql}`,
    [id, ...condiciones.parametros]
  )
  return incluirFotoPerfil(filas[0] || null)
}

async function buscarPorId(usuario, id) {
  return buscarPorIdConConexion(usuario, id, db)
}

async function listar(usuario, query = {}) {
  const condiciones = filtro(usuario, query.idInmobiliaria, query.q)
  const pagina = Math.max(1, Number.parseInt(query.page, 10) || 1)
  const limite = Math.min(10, Math.max(1, Number.parseInt(query.limit, 10) || 10))
  const offset = (pagina - 1) * limite

  const [filas, conteo] = await Promise.all([
    db.execute(
      `${SELECT_PROPIETARIO}
       WHERE ${condiciones.sql}
       ORDER BY p.apellido, p.nombre, pr.id
       LIMIT ? OFFSET ?`,
      [...condiciones.parametros, limite, offset]
    ),
    db.execute(
      `SELECT COUNT(*) AS total
       FROM propietarios pr
       INNER JOIN personas p
         ON p.id = pr.idPersona
         AND p.idInmobiliaria = pr.idInmobiliaria
       INNER JOIN usuarios u
         ON u.idPersona = p.id
         AND u.idInmobiliaria = pr.idInmobiliaria
       WHERE ${condiciones.sql}`,
      condiciones.parametros
    ),
  ])

  const total = Number(conteo[0][0].total)
  return {
    items: filas[0].map(incluirFotoPerfil),
    paginacion: {
      pagina,
      limite,
      total,
      paginas: Math.ceil(total / limite),
    },
  }
}

async function resumen(usuario) {
  const idInmobiliaria = alcance(usuario)
  const [activos, cobros, porGenerar] = await Promise.all([
    db.execute(
      `SELECT pr.id FROM propietarios pr WHERE pr.idInmobiliaria = ? AND pr.activo = 1`,
      [idInmobiliaria]
    ),
    db.execute(
      `SELECT ec.nombre AS estado, co.idPropietario AS id, COUNT(*) AS cantidad
       FROM cobros co
       INNER JOIN estadosCobros ec ON ec.id = co.idEstado
       WHERE co.idInmobiliaria = ? AND ec.nombre IN ('Pendiente', 'Liquidado')
       GROUP BY ec.nombre, co.idPropietario`,
      [idInmobiliaria]
    ),
    db.execute(
      `SELECT pr.id, COUNT(DISTINCT p.id) AS cantidad
       FROM pagos p
       INNER JOIN estadosPagos ep ON ep.id = p.idEstado
       INNER JOIN contratosPersonas cp
         ON cp.idContrato = p.idContrato AND cp.idInmobiliaria = p.idInmobiliaria
       INNER JOIN tiposParticipacion tp ON tp.id = cp.idTipoParticipacion
       INNER JOIN propietarios pr
         ON pr.idPersona = cp.idPersona AND pr.idInmobiliaria = cp.idInmobiliaria
       LEFT JOIN cobros co
         ON co.idPago = p.id AND co.idPropietario = pr.id AND co.idInmobiliaria = p.idInmobiliaria
       WHERE p.idInmobiliaria = ? AND ep.nombre = 'Aprobado'
         AND tp.nombre = 'Propietario' AND co.id IS NULL
       GROUP BY pr.id`,
      [idInmobiliaria]
    ),
  ])

  const agrupar = (filas) => ({
    total: filas.reduce((suma, fila) => suma + Number(fila.cantidad), 0),
    ids: filas.map((fila) => Number(fila.id)),
  })

  return {
    cobrosPendientes: agrupar(cobros[0].filter((fila) => fila.estado === 'Pendiente')),
    liquidacionesPorGenerar: agrupar(porGenerar[0]),
    propietariosActivos: { total: activos[0].length, ids: activos[0].map((fila) => Number(fila.id)) },
    cobrosAcreditados: agrupar(cobros[0].filter((fila) => fila.estado === 'Liquidado')),
  }
}

async function crear(usuario, cuerpo = {}) {
  const idInmobiliaria = alcance(usuario, cuerpo.idInmobiliaria)
  if (idInmobiliaria === null) {
    throw new Error("La inmobiliaria es obligatoria para crear un propietario")
  }

  const activacion = crearTokenActivacion()
  const conexion = await db.getConnection()

  try {
    await conexion.beginTransaction()

    const [persona] = await conexion.execute(
        `INSERT INTO personas
          (idInmobiliaria, nombre, apellido, correo, dni, telefono, direccion)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          idInmobiliaria,
          cuerpo.nombre ?? null,
          cuerpo.apellido ?? null,
          cuerpo.correo ?? null,
          cuerpo.dni,
          cuerpo.telefono ?? null,
          cuerpo.direccion ?? null,
        ]
    )
    const idPersona = persona.insertId

    const [usuarioCreado] = await conexion.execute(
      `INSERT INTO usuarios
        (idInmobiliaria, idPersona, idRol)
       VALUES (?, ?, ?)`,
      [idInmobiliaria, idPersona, PROPIETARIO]
    )

    await conexion.execute(
      `INSERT INTO tokensAcceso
        (idUsuario, tokenHash, proposito, fechaExpiracion)
       VALUES (?, ?, 'ACTIVACION', ?)`,
      [usuarioCreado.insertId, activacion.hash, activacion.fechaExpiracion]
    )

    const [propietario] = await conexion.execute(
      `INSERT INTO propietarios
        (idInmobiliaria, idPersona, cbu, alias, activo)
       VALUES (?, ?, ?, ?, ?)`,
      [
        idInmobiliaria,
        idPersona,
        cuerpo.cbu ?? null,
        cuerpo.alias ?? null,
        cuerpo.activo ?? true,
      ]
    )

    await avisarAlta(conexion, idInmobiliaria, PROPIETARIO, cuerpo)
    await conexion.commit()
    return {
      ...(await buscarPorId(usuario, propietario.insertId)),
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
       FROM propietarios pr
       INNER JOIN personas p ON p.id = pr.idPersona AND p.idInmobiliaria = pr.idInmobiliaria
       INNER JOIN usuarios u ON u.idPersona = p.id AND u.idInmobiliaria = pr.idInmobiliaria
       WHERE pr.id = ? AND ${condiciones.sql}
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
  const conexion = await db.getConnection()

  try {
    await conexion.beginTransaction()
    const propietario = await buscarPorIdConConexion(usuario, id, conexion)

    if (!propietario) {
      await conexion.rollback()
      return null
    }

    const camposPersona = {
      nombre: "nombre",
      apellido: "apellido",
      correo: "correo",
      telefono: "telefono",
      direccion: "direccion",
    }
    const cambiosPersona = Object.entries(camposPersona)
      .filter(([campo]) => tiene(cuerpo, campo))

    if (cambiosPersona.length) {
      await conexion.execute(
        `UPDATE personas
         SET ${cambiosPersona.map(([, columna]) => `\`${columna}\` = ?`).join(", ")}
         WHERE id = ? AND idInmobiliaria = ?`,
        [
          ...cambiosPersona.map(([campo]) => cuerpo[campo]),
          propietario.idPersona,
          propietario.idInmobiliaria,
        ]
      )
    }

    const camposPropietario = {
      cbu: "cbu",
      alias: "alias",
      activo: "activo",
    }
    const cambiosPropietario = Object.entries(camposPropietario)
      .filter(([campo]) => tiene(cuerpo, campo))

    if (cambiosPropietario.length) {
      await conexion.execute(
        `UPDATE propietarios
         SET ${cambiosPropietario.map(([, columna]) => `\`${columna}\` = ?`).join(", ")}
         WHERE id = ? AND idInmobiliaria = ?`,
        [
          ...cambiosPropietario.map(([campo]) => cuerpo[campo]),
          id,
          propietario.idInmobiliaria,
        ]
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

async function eliminar(usuario, id) {
  const conexion = await db.getConnection()

  try {
    await conexion.beginTransaction()
    const propietario = await buscarPorIdConConexion(usuario, id, conexion)

    if (!propietario) {
      await conexion.rollback()
      return false
    }

    const archivosEliminar = await prepararEliminacionArchivos(conexion, propietario)
    await conexion.execute(
      "DELETE FROM tokensAcceso WHERE idUsuario = ?",
      [propietario.idUsuario]
    )
    await conexion.execute(
      "DELETE FROM propietarios WHERE id = ? AND idInmobiliaria = ?",
      [id, propietario.idInmobiliaria]
    )
    await conexion.execute(
      "DELETE FROM usuarios WHERE id = ? AND idInmobiliaria = ? AND idRol = ?",
      [propietario.idUsuario, propietario.idInmobiliaria, PROPIETARIO]
    )
    await conexion.execute(
      "DELETE FROM personas WHERE id = ? AND idInmobiliaria = ?",
      [propietario.idPersona, propietario.idInmobiliaria]
    )

    await conexion.commit()
    await limpiar(archivosEliminar)
    desconectarUsuario(propietario.idUsuario)
    return true
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}

async function personaDelUsuario(idUsuario, idInmobiliaria) {
  const [filas] = await db.execute(
    `SELECT pr.idPersona
     FROM propietarios pr
     INNER JOIN usuarios u
       ON u.idPersona = pr.idPersona
       AND u.idInmobiliaria = pr.idInmobiliaria
     WHERE u.id = ?
       AND pr.idInmobiliaria = ?`,
    [idUsuario, idInmobiliaria]
  )
  return filas[0]?.idPersona ?? null
}

function incluirFotoPerfil(persona) {
  return persona ? { ...persona, urlFotoPerfil: persona.fotoPerfil ? `/uploads/perfiles/${persona.fotoPerfil}` : null } : persona
}

async function listarArchivos(entidad, conexion = db) {
  const [filas] = await conexion.execute(
    "SELECT fotoPerfil FROM personas WHERE id = ? AND (idInmobiliaria <=> ?)",
    [entidad.idPersona, entidad.idInmobiliaria]
  )
  if (!filas.length) throw problema("NO_ENCONTRADO")
  return { fotoPerfil: filas[0].fotoPerfil || null,
    urlFotoPerfil: filas[0].fotoPerfil ? `/uploads/perfiles/${filas[0].fotoPerfil}` : null,
    documentos: await listarDocumentos(entidad, conexion) }
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

async function listarDocumentos(entidad, conexion = db) {
  const [filas] = await conexion.execute(
    `SELECT d.id, d.titulo, d.tipo, v.nombreArchivo, v.mimeType, v.tamanioBytes, v.numeroVersion
     FROM documentos d LEFT JOIN versionesDocumentos v
       ON v.idDocumento = d.id AND v.idInmobiliaria = d.idInmobiliaria
       AND v.numeroVersion = (SELECT MAX(numeroVersion) FROM versionesDocumentos
         WHERE idDocumento = d.id AND idInmobiliaria = d.idInmobiliaria)
     WHERE d.idPersona = ? AND d.idInmobiliaria <=> ? ORDER BY d.id`,
    [ entidad.idPersona, entidad.idInmobiliaria ]
  )
  return filas
}

async function buscarDocumento(entidad, idArchivo, conexion = db) {
  const [filas] = await conexion.execute(
    `SELECT v.nombreArchivo, v.rutaArchivo, v.mimeType, v.numeroVersion
     FROM documentos d INNER JOIN versionesDocumentos v
       ON v.idDocumento = d.id AND v.idInmobiliaria = d.idInmobiliaria
     WHERE d.id = ? AND d.idPersona = ? AND d.idInmobiliaria <=> ?
     ORDER BY v.numeroVersion DESC`,
    [idArchivo, entidad.idPersona, entidad.idInmobiliaria]
  )
  return filas
}

async function cargarDocumentos(entidad, entradas, idUsuario) {
  const nuevos = await guardarLote(entradas, "documentos", ["pdf"], true)
  let conexion
  let confirmado = false
  try {
    conexion = await db.getConnection()
    await conexion.beginTransaction()
    const [entidades] = await conexion.execute(
      "SELECT id FROM personas WHERE id = ? AND idInmobiliaria <=> ? FOR UPDATE",
      [ entidad.idPersona, entidad.idInmobiliaria ]
    )
    if (!entidades.length) throw problema("NO_ENCONTRADO")
    for (const nuevo of nuevos) {
      const [documento] = await conexion.execute(
        "INSERT INTO documentos (idInmobiliaria, idPersona, titulo, tipo) VALUES (?, ?, ?, 'PDF')",
        [entidad.idInmobiliaria, entidad.idPersona, nuevo.nombreOriginal]
      )
      await conexion.execute(
        `INSERT INTO versionesDocumentos
         (idInmobiliaria, idDocumento, numeroVersion, nombreArchivo, rutaArchivo, mimeType, tamanioBytes, idUsuarioAutor)
         VALUES (?, ?, 1, ?, ?, ?, ?, ?)`,
        [entidad.idInmobiliaria, documento.insertId, nuevo.nombreOriginal, nuevo.nombre,
          nuevo.mimeType, nuevo.tamanioBytes, idUsuario]
      )
    }
    const resultado = await listarArchivos(entidad, conexion)
    await conexion.commit()
    confirmado = true
    return resultado
  } catch (error) {
    if (conexion && !confirmado) await conexion.rollback()
    throw error
  } finally {
    conexion?.release()
    if (!confirmado) await limpiar(nuevos)
  }
}

async function modificarDocumento(entidad, idArchivo, entradas, idUsuario) {
  const [nuevo] = await guardarLote(entradas, "documentos", ["pdf"], true)
  let conexion
  let confirmado = false
  try {
    conexion = await db.getConnection()
    await conexion.beginTransaction()
    const [documentos] = await conexion.execute(
      "SELECT id FROM documentos WHERE id = ? AND idPersona = ? AND idInmobiliaria <=> ? FOR UPDATE",
      [idArchivo, entidad.idPersona, entidad.idInmobiliaria]
    )
    if (!documentos.length) throw problema("NO_ENCONTRADO")
    const [versiones] = await conexion.execute(
      "SELECT COALESCE(MAX(numeroVersion), 0) + 1 AS siguiente FROM versionesDocumentos WHERE idDocumento = ? AND idInmobiliaria = ?",
      [idArchivo, entidad.idInmobiliaria]
    )
    await conexion.execute(
      `INSERT INTO versionesDocumentos
       (idInmobiliaria, idDocumento, numeroVersion, nombreArchivo, rutaArchivo, mimeType, tamanioBytes, idUsuarioAutor)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [entidad.idInmobiliaria, idArchivo, Number(versiones[0].siguiente), nuevo.nombreOriginal,
        nuevo.nombre, nuevo.mimeType, nuevo.tamanioBytes, idUsuario]
    )
    const resultado = await listarArchivos(entidad, conexion)
    await conexion.commit()
    confirmado = true
    return resultado
  } catch (error) {
    if (conexion && !confirmado) await conexion.rollback()
    throw error
  } finally {
    conexion?.release()
    if (!confirmado) await limpiar([nuevo])
  }
}

async function eliminarDocumento(entidad, idArchivo) {
  const conexion = await db.getConnection()
  let versiones
  try {
    await conexion.beginTransaction()
    const [documentos] = await conexion.execute(
      "SELECT id FROM documentos WHERE id = ? AND idPersona = ? AND idInmobiliaria <=> ? FOR UPDATE",
      [idArchivo, entidad.idPersona, entidad.idInmobiliaria]
    )
    if (!documentos.length) throw problema("NO_ENCONTRADO")
    versiones = await buscarDocumento(entidad, idArchivo, conexion)
    await conexion.execute(
      "DELETE FROM versionesDocumentos WHERE idDocumento = ? AND idInmobiliaria = ?",
      [idArchivo, entidad.idInmobiliaria]
    )
    await conexion.execute(
      "DELETE FROM documentos WHERE id = ? AND idPersona = ? AND idInmobiliaria <=> ?",
      [idArchivo, entidad.idPersona, entidad.idInmobiliaria]
    )
    await conexion.commit()
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
  await limpiar(versiones.map((version) => ({ destino: "documentos", nombre: version.rutaArchivo, privado: true })))
}

module.exports = { listar, resumen, buscarPorId, crear, generarEnlaceActivacion, actualizar, eliminar, personaDelUsuario , listarArchivos, cargarFoto, eliminarFoto, listarDocumentos, buscarDocumento, cargarDocumentos, modificarDocumento, eliminarDocumento}
