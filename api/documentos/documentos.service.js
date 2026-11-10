const db = require("../../db/conexion")
const { fechaLocal } = require("../../utils/fechas")
const { PROPIETARIO, INQUILINO } = require("../../config/roles")
const { VINCULOS } = require("./documentos.schema")

const ROLES_PARTES = [PROPIETARIO, INQUILINO]
const FIN_EFECTIVO = "LEAST(COALESCE(c.fechaFin, c.fechaRescision), COALESCE(c.fechaRescision, c.fechaFin))"

const SELECT_DOCUMENTO = `
  SELECT
    d.id,
    d.titulo,
    d.tipo,
    d.visibilidad,
    d.idPropiedad,
    d.idContrato,
    d.idPersona,
    d.idReporte,
    d.idCobro,
    d.fechaCreacion,
    d.fechaArchivado,
    d.motivoArchivo,
    v.numeroVersion AS version,
    v.nombreArchivo,
    v.mimeType,
    v.tamanioBytes,
    v.fechaCreacion AS fechaVersion
  FROM documentos d
  INNER JOIN versionesDocumentos v
    ON v.idDocumento = d.id
    AND v.idInmobiliaria = d.idInmobiliaria
    AND v.numeroVersion = (
      SELECT MAX(v2.numeroVersion)
      FROM versionesDocumentos v2
      WHERE v2.idDocumento = d.id
        AND v2.idInmobiliaria = d.idInmobiliaria
    )
`

const normalizar = (fila) => ({ ...fila, tamanioBytes: fila.tamanioBytes === null ? null : Number(fila.tamanioBytes) })
const esParte = (usuario) => ROLES_PARTES.includes(usuario.rol)

async function personaDelUsuario(idUsuario) {
  const [filas] = await db.execute(`SELECT u.idPersona FROM usuarios u WHERE u.id = ?`, [idUsuario])
  return filas[0]?.idPersona ?? null
}

async function alcance(usuario) {
  const condiciones = ["d.idInmobiliaria = ?"]
  const parametros = [usuario.idInmobi]
  if (!esParte(usuario)) {
    return { condiciones, parametros }
  }

  const persona = (await personaDelUsuario(usuario.id)) ?? 0
  const hoy = fechaLocal()
  condiciones.push("d.visibilidad = 'PARTES'", "d.fechaArchivado IS NULL")
  condiciones.push(`(
    (d.idContrato IS NOT NULL AND EXISTS (
      SELECT 1 FROM contratosPersonas cp
      WHERE cp.idContrato = d.idContrato AND cp.idInmobiliaria = d.idInmobiliaria AND cp.idPersona = ?
    ))
    OR d.idPersona = ?
    OR (d.idPropiedad IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM propiedadesPersonas pp
        INNER JOIN tiposParticipacion tp ON tp.id = pp.idTipoParticipacion
        WHERE pp.idPropiedad = d.idPropiedad AND pp.idInmobiliaria = d.idInmobiliaria
          AND pp.idPersona = ? AND tp.nombre = 'Propietario'
      )
      OR EXISTS (
        SELECT 1 FROM contratos c
        INNER JOIN tiposContratos tc ON tc.id = c.idTipoContrato
        INNER JOIN estadosContratos ec ON ec.id = c.idEstadoContrato
        INNER JOIN contratosPersonas cp ON cp.idContrato = c.id AND cp.idInmobiliaria = c.idInmobiliaria
        INNER JOIN tiposParticipacion tp ON tp.id = cp.idTipoParticipacion
        WHERE c.idPropiedad = d.idPropiedad AND c.idInmobiliaria = d.idInmobiliaria
          AND tc.nombre = 'Alquiler' AND ec.nombre NOT IN ('Borrador', 'Anulado')
          AND tp.nombre = 'Inquilino' AND cp.idPersona = ?
          AND c.fechaInicio <= ? AND (${FIN_EFECTIVO} IS NULL OR ${FIN_EFECTIVO} >= ?)
      )
    ))
    OR (d.idReporte IS NOT NULL AND EXISTS (
      SELECT 1 FROM reportes r
      WHERE r.id = d.idReporte AND r.idInmobiliaria = d.idInmobiliaria
        AND (r.idPersonaReporta = ? OR EXISTS (
          SELECT 1 FROM propiedadesPersonas pp
          INNER JOIN tiposParticipacion tp ON tp.id = pp.idTipoParticipacion
          WHERE pp.idPropiedad = r.idPropiedad AND pp.idInmobiliaria = r.idInmobiliaria
            AND pp.idPersona = ? AND tp.nombre = 'Propietario'
        ))
    ))
    OR (d.idCobro IS NOT NULL AND EXISTS (
      SELECT 1 FROM cobros co
      INNER JOIN propietarios pr ON pr.id = co.idPropietario AND pr.idInmobiliaria = co.idInmobiliaria
      WHERE co.id = d.idCobro AND co.idInmobiliaria = d.idInmobiliaria AND pr.idPersona = ?
    ))
  )`)
  parametros.push(persona, persona, persona, persona, hoy, hoy, persona, persona, persona)
  return { condiciones, parametros }
}

async function listar(usuario, filtros = {}) {
  const { page = 1, limit = 20 } = filtros
  const { condiciones, parametros } = await alcance(usuario)

  for (const campo of VINCULOS) {
    if (filtros[campo]) {
      condiciones.push(`d.${campo} = ?`)
      parametros.push(filtros[campo])
    }
  }
  if (filtros.tipo) {
    condiciones.push("d.tipo = ?")
    parametros.push(filtros.tipo)
  }
  condiciones.push(filtros.archivados === "true" ? "d.fechaArchivado IS NOT NULL" : "d.fechaArchivado IS NULL")

  const donde = `WHERE ${condiciones.join(" AND ")}`
  const offset = (page - 1) * limit
  const [[filas], [conteo]] = await Promise.all([
    db.execute(`${SELECT_DOCUMENTO} ${donde} ORDER BY d.fechaCreacion DESC, d.id DESC LIMIT ? OFFSET ?`, [...parametros, limit, offset]),
    db.execute(`SELECT COUNT(*) AS total FROM documentos d ${donde}`, parametros),
  ])

  const total = Number(conteo[0].total)
  return {
    items: filas.map(normalizar),
    paginacion: { pagina: page, limite: limit, total, paginas: Math.ceil(total / limit) },
  }
}

async function buscarPorId(usuario, id) {
  const { condiciones, parametros } = await alcance(usuario)
  const [filas] = await db.execute(`${SELECT_DOCUMENTO} WHERE ${condiciones.join(" AND ")} AND d.id = ?`, [...parametros, id])
  if (!filas.length) {
    return null
  }

  const [versiones] = await db.execute(
    `SELECT
       v.numeroVersion,
       v.nombreArchivo,
       v.mimeType,
       v.tamanioBytes,
       v.comentario,
       v.fechaCreacion,
       v.idUsuarioAutor,
       CONCAT(per.nombre, ' ', per.apellido) AS autor
     FROM versionesDocumentos v
     LEFT JOIN usuarios u ON u.id = v.idUsuarioAutor
     LEFT JOIN personas per ON per.id = u.idPersona
     WHERE v.idDocumento = ?
       AND v.idInmobiliaria = ?
     ORDER BY v.numeroVersion DESC`,
    [id, usuario.idInmobi]
  )
  return { ...normalizar(filas[0]), versiones: versiones.map(normalizar) }
}

async function archivoParaDescargar(usuario, id, numero = null) {
  const documento = await buscarPorId(usuario, id)
  if (!documento) {
    return null
  }
  const [filas] = await db.execute(
    `SELECT v.nombreArchivo, v.rutaArchivo, v.mimeType
     FROM versionesDocumentos v
     WHERE v.idDocumento = ? AND v.idInmobiliaria = ? AND v.numeroVersion = ?`,
    [id, usuario.idInmobi, numero ?? documento.version]
  )
  return filas[0] || null
}

async function crear(usuario, datos, archivo) {
  const conexion = await db.getConnection()
  try {
    await conexion.beginTransaction()
    const [documento] = await conexion.execute(
      `INSERT INTO documentos (idInmobiliaria, ${VINCULOS.join(", ")}, titulo, tipo, visibilidad)
       VALUES (?, ${VINCULOS.map(() => "?").join(", ")}, ?, ?, ?)`,
      [usuario.idInmobi, ...VINCULOS.map((campo) => datos[campo] ?? null), datos.titulo, datos.tipo, datos.visibilidad]
    )
    await insertarVersion(conexion, usuario, documento.insertId, 1, archivo, null)
    await conexion.commit()
    return { documento: await buscarPorId(usuario, documento.insertId) }
  } catch (error) {
    await conexion.rollback()
    if (error.code === "ER_NO_REFERENCED_ROW_2") {
      return { error: "NO_ENCONTRADO", mensaje: "La propiedad, contrato, persona, reporte o cobro vinculado no existe" }
    }
    throw error
  } finally {
    conexion.release()
  }
}

async function insertarVersion(conexion, usuario, idDocumento, numero, archivo, comentario) {
  await conexion.execute(
    `INSERT INTO versionesDocumentos
       (idInmobiliaria, idDocumento, numeroVersion, nombreArchivo, rutaArchivo, mimeType, tamanioBytes, idUsuarioAutor, comentario)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [usuario.idInmobi, idDocumento, numero, archivo.nombreArchivo, archivo.rutaArchivo, archivo.mimeType, archivo.tamanioBytes, usuario.id, comentario]
  )
}

async function bloquear(conexion, usuario, id) {
  const [filas] = await conexion.execute(
    `SELECT d.id, d.fechaArchivado FROM documentos d WHERE d.id = ? AND d.idInmobiliaria = ? FOR UPDATE`,
    [id, usuario.idInmobi]
  )
  return filas[0] || null
}

async function enTransaccion(usuario, id, accion) {
  const conexion = await db.getConnection()
  try {
    await conexion.beginTransaction()
    const documento = await bloquear(conexion, usuario, id)
    if (!documento) {
      await conexion.rollback()
      return { error: "NO_ENCONTRADO", mensaje: "El documento no existe" }
    }
    const error = await accion(conexion, documento)
    if (error) {
      await conexion.rollback()
      return error
    }
    await conexion.commit()
    return { documento: await buscarPorId(usuario, id) }
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}

const archivado = { error: "CONFLICTO", mensaje: "El documento está archivado" }

function agregarVersion(usuario, id, comentario, archivo) {
  return enTransaccion(usuario, id, async (conexion, documento) => {
    if (documento.fechaArchivado) {
      return archivado
    }
    const [filas] = await conexion.execute(
      `SELECT COALESCE(MAX(v.numeroVersion), 0) + 1 AS siguiente FROM versionesDocumentos v WHERE v.idDocumento = ? AND v.idInmobiliaria = ?`,
      [id, usuario.idInmobi]
    )
    await insertarVersion(conexion, usuario, id, Number(filas[0].siguiente), archivo, comentario)
    return null
  })
}

function actualizar(usuario, id, cambios) {
  return enTransaccion(usuario, id, async (conexion, documento) => {
    if (documento.fechaArchivado) {
      return archivado
    }
    const campos = ["titulo", "tipo", "visibilidad"].filter((campo) => campo in cambios)
    await conexion.execute(
      `UPDATE documentos SET ${campos.map((campo) => `${campo} = ?`).join(", ")} WHERE id = ? AND idInmobiliaria = ?`,
      [...campos.map((campo) => cambios[campo]), id, usuario.idInmobi]
    )
    return null
  })
}

function archivar(usuario, id, motivo) {
  return enTransaccion(usuario, id, async (conexion, documento) => {
    if (documento.fechaArchivado) {
      return { error: "CONFLICTO", mensaje: "El documento ya está archivado" }
    }
    await conexion.execute(
      `UPDATE documentos SET fechaArchivado = CURRENT_TIMESTAMP, motivoArchivo = ? WHERE id = ? AND idInmobiliaria = ?`,
      [motivo, id, usuario.idInmobi]
    )
    return null
  })
}

function desarchivar(usuario, id) {
  return enTransaccion(usuario, id, async (conexion, documento) => {
    if (!documento.fechaArchivado) {
      return { error: "CONFLICTO", mensaje: "El documento no está archivado" }
    }
    await conexion.execute(
      `UPDATE documentos SET fechaArchivado = NULL, motivoArchivo = NULL WHERE id = ? AND idInmobiliaria = ?`,
      [id, usuario.idInmobi]
    )
    return null
  })
}

async function listarDeContratos(usuario, idsContratos) {
  if (!idsContratos.length) {
    return []
  }
  const { condiciones, parametros } = await alcance(usuario)
  const [filas] = await db.execute(
    `${SELECT_DOCUMENTO}
     WHERE ${condiciones.join(" AND ")}
       AND d.fechaArchivado IS NULL
       AND d.idContrato IN (${idsContratos.map(() => "?").join(", ")})
     ORDER BY d.fechaCreacion, d.id`,
    [...parametros, ...idsContratos]
  )
  return filas.map(normalizar)
}

module.exports = {
  listar,
  buscarPorId,
  archivoParaDescargar,
  crear,
  agregarVersion,
  actualizar,
  archivar,
  desarchivar,
  listarDeContratos,
}
