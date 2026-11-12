const db = require("../../db/conexion")
const { problema, limpiar, guardarLote } = require("../../utils/adjuntos")

const SELECT_REPORTE = `
  SELECT
    r.id,
    r.idInmobiliaria,
    r.idPropiedad,
    p.nombre AS propiedad,
    r.idCategoria,
    c.nombre AS categoria,
    r.idEstado,
    e.nombre AS estado,
    r.idPersonaReporta,
    CONCAT(persona.nombre, ' ', persona.apellido) AS personaReporta,
    r.idProfesional,
    prof.profesion,
    r.prioridad,
    r.titulo,
    r.descripcion,
    r.fecha
  FROM reportes r
  INNER JOIN propiedades p
    ON p.id = r.idPropiedad AND p.idInmobiliaria = r.idInmobiliaria
  INNER JOIN categorias c ON c.id = r.idCategoria
  INNER JOIN estadosReportes e ON e.id = r.idEstado
  INNER JOIN personas persona
    ON persona.id = r.idPersonaReporta
    AND persona.idInmobiliaria = r.idInmobiliaria
  LEFT JOIN profesionales prof
    ON prof.id = r.idProfesional
    AND prof.idInmobiliaria = r.idInmobiliaria
`

function alcance(usuario, valor) {
  return usuario && usuario.idInmobi !== undefined ? usuario.idInmobi : valor
}

function condiciones(usuario, valorInmobiliaria, busqueda) {
  const inmobiliaria = alcance(usuario, valorInmobiliaria)
  const filtros = []
  const parametros = []

  if (inmobiliaria !== undefined && inmobiliaria !== null) {
    filtros.push("r.idInmobiliaria = ?")
    parametros.push(inmobiliaria)
  }
  if (usuario && [4, 5].includes(usuario.rol)) {
    filtros.push(`EXISTS (
      SELECT 1 FROM contratos c
      INNER JOIN contratosPersonas cp ON cp.idContrato = c.id AND cp.idInmobiliaria = c.idInmobiliaria
      INNER JOIN usuarios u ON u.idPersona = cp.idPersona AND u.idInmobiliaria = cp.idInmobiliaria
      WHERE c.idPropiedad = r.idPropiedad AND c.idInmobiliaria = r.idInmobiliaria AND u.id = ?
    )`)
    parametros.push(usuario.id)
  }
  if (busqueda) {
    filtros.push("(r.titulo LIKE ? OR r.descripcion LIKE ? OR r.prioridad LIKE ?)")
    const texto = `%${busqueda}%`
    parametros.push(texto, texto, texto)
  }

  return {
    sql: filtros.length ? ` WHERE ${filtros.join(" AND ")}` : "",
    parametros,
    inmobiliaria,
  }
}

async function listar(usuario, query = {}) {
  const filtro = condiciones(usuario, query.idInmobiliaria, query.q)
  const pagina = Number(query.page || 1)
  const limite = Number(query.limit || 10)
  const offset = (pagina - 1) * limite

  const [filas, conteo] = await Promise.all([
    db.execute(
      `${SELECT_REPORTE}
       ${filtro.sql}
       ORDER BY r.fecha DESC, r.id DESC
       LIMIT ? OFFSET ?`,
      [...filtro.parametros, limite, offset]
    ),
    db.execute(
      `SELECT COUNT(*) AS total
       FROM reportes r
       ${filtro.sql}`,
      filtro.parametros
    ),
  ])

  const total = Number(conteo[0][0].total)
  const items = await incluirImagenes(filas[0])
  return {
    items,
    paginacion: { pagina, limite, total, paginas: Math.ceil(total / limite) },
  }
}

async function buscarPorId(usuario, id) {
  const filtro = condiciones(usuario)
  const where = filtro.sql
    ? `${filtro.sql} AND r.id = ?`
    : " WHERE r.id = ?"
  const [filas] = await db.execute(
    `${SELECT_REPORTE}${where}`,
    [...filtro.parametros, id]
  )
  if (!filas.length) return null
  const [reporte] = await incluirImagenes(filas)
  return reporte
}

async function crear(usuario, cuerpo = {}) {
  const inmobiliaria = alcance(usuario, cuerpo.idInmobiliaria)
  const [personas] = await db.execute(
    `SELECT idPersona
     FROM usuarios
     WHERE id = ? AND idInmobiliaria = ?`,
    [usuario && usuario.id, inmobiliaria]
  )
  const idPersonaReporta = personas[0]?.idPersona ?? cuerpo.idPersonaReporta

  const [resultado] = await db.execute(
    `INSERT INTO reportes
      (idInmobiliaria, idPropiedad, idCategoria, idEstado,
       idPersonaReporta, idProfesional, prioridad, titulo,
       descripcion, fecha)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      inmobiliaria,
      cuerpo.idPropiedad,
      cuerpo.idCategoria,
      cuerpo.idEstado,
      idPersonaReporta,
      cuerpo.idProfesional ?? null,
      cuerpo.prioridad ?? "MEDIA",
      cuerpo.titulo,
      cuerpo.descripcion ?? null,
      cuerpo.fecha,
    ]
  )

  return buscarPorId(usuario, resultado.insertId)
}

async function actualizar(usuario, id, cuerpo = {}) {
  const campos = {
    idPropiedad: "idPropiedad",
    idCategoria: "idCategoria",
    idEstado: "idEstado",
    idProfesional: "idProfesional",
    prioridad: "prioridad",
    titulo: "titulo",
    descripcion: "descripcion",
    fecha: "fecha",
  }
  const cambios = Object.entries(campos)
    .filter(([campo]) => Object.hasOwn(cuerpo, campo))

  const inmobiliaria = alcance(usuario)
  const parametros = cambios.map(([campo]) => cuerpo[campo])
  const where = ["id = ?"]
  parametros.push(id)

  if (inmobiliaria !== undefined && inmobiliaria !== null) {
    where.push("idInmobiliaria = ?")
    parametros.push(inmobiliaria)
  }

  if (cambios.length) {
    await db.execute(
      `UPDATE reportes
       SET ${cambios.map(([, columna]) => `\`${columna}\` = ?`).join(", ")}
       WHERE ${where.join(" AND ")}`,
      parametros
    )
  }

  return buscarPorId(usuario, id)
}

async function eliminar(usuario, id) {
  const inmobiliaria = alcance(usuario)
  const parametros = [id]
  const where = ["id = ?"]

  if (inmobiliaria !== undefined && inmobiliaria !== null) {
    where.push("idInmobiliaria = ?")
    parametros.push(inmobiliaria)
  }

  const conexion = await db.getConnection()
  try {
    await conexion.beginTransaction()
    const [filas] = await conexion.execute(`SELECT id, idInmobiliaria FROM reportes WHERE ${where.join(" AND ")} FOR UPDATE`, parametros)
    if (!filas.length) { await conexion.rollback(); return false }
    const archivosEliminar = await prepararEliminacionArchivos(conexion, filas[0])
    await conexion.execute(`DELETE FROM reportes WHERE ${where.join(" AND ")}`, parametros)
    await conexion.commit()
    await limpiar(archivosEliminar)
    return true
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}

async function contarSinResolver(idInmobiliaria) {
  const [filas] = await db.execute(
    `SELECT COUNT(*) AS total
     FROM reportes r
     INNER JOIN estadosReportes e ON e.id = r.idEstado
     WHERE r.idInmobiliaria = ?
       AND e.nombre <> 'Resuelto'`,
    [idInmobiliaria]
  )
  return Number(filas[0].total)
}

async function listarSinRevisar(idInmobiliaria, limite = 5) {
  const [[filas], [conteo]] = await Promise.all([
    db.execute(
      `SELECT
         r.id,
         r.titulo,
         r.prioridad,
         r.fecha,
         r.idPropiedad,
         p.nombre AS propiedad,
         r.idPersonaReporta,
         CONCAT(persona.nombre, ' ', persona.apellido) AS personaReporta,
         (
           SELECT ri.nombre
           FROM reportesImagenes ri
           WHERE ri.idReporte = r.id
             AND ri.idInmobiliaria = r.idInmobiliaria
           ORDER BY ri.id
           LIMIT 1
         ) AS imagen
       FROM reportes r
       INNER JOIN estadosReportes e ON e.id = r.idEstado
       INNER JOIN propiedades p
         ON p.id = r.idPropiedad AND p.idInmobiliaria = r.idInmobiliaria
       INNER JOIN personas persona
         ON persona.id = r.idPersonaReporta
         AND persona.idInmobiliaria = r.idInmobiliaria
       WHERE r.idInmobiliaria = ?
         AND e.nombre = 'Abierto'
       ORDER BY r.fecha DESC, r.id DESC
       LIMIT ?`,
      [idInmobiliaria, limite]
    ),
    db.execute(
      `SELECT COUNT(*) AS total
       FROM reportes r
       INNER JOIN estadosReportes e ON e.id = r.idEstado
       WHERE r.idInmobiliaria = ?
         AND e.nombre = 'Abierto'`,
      [idInmobiliaria]
    ),
  ])

  return { total: Number(conteo[0].total), items: filas }
}

async function listarDePropiedades(idInmobiliaria, idsPropiedades, limite = 5, { soloSinRevisar = false } = {}) {
  if (!idsPropiedades.length) {
    return { total: 0, items: [] }
  }
  const enPropiedades = `r.idPropiedad IN (${idsPropiedades.map(() => "?").join(", ")})${soloSinRevisar ? " AND e.nombre = 'Abierto'" : ""}`

  const [[filas], [conteo]] = await Promise.all([
    db.execute(
      `SELECT
         r.id,
         r.titulo,
         r.prioridad,
         r.fecha,
         e.nombre AS estado,
         r.idPropiedad,
         p.nombre AS propiedad,
         CONCAT(persona.nombre, ' ', persona.apellido) AS personaReporta,
         (
           SELECT ri.nombre
           FROM reportesImagenes ri
           WHERE ri.idReporte = r.id
             AND ri.idInmobiliaria = r.idInmobiliaria
           ORDER BY ri.id
           LIMIT 1
         ) AS imagen
       FROM reportes r
       INNER JOIN estadosReportes e ON e.id = r.idEstado
       INNER JOIN propiedades p
         ON p.id = r.idPropiedad AND p.idInmobiliaria = r.idInmobiliaria
       INNER JOIN personas persona
         ON persona.id = r.idPersonaReporta
         AND persona.idInmobiliaria = r.idInmobiliaria
       WHERE r.idInmobiliaria = ?
         AND ${enPropiedades}
       ORDER BY r.fecha DESC, r.id DESC
       LIMIT ?`,
      [idInmobiliaria, ...idsPropiedades, limite]
    ),
    db.execute(
      `SELECT COUNT(*) AS total
       FROM reportes r
       INNER JOIN estadosReportes e ON e.id = r.idEstado
       WHERE r.idInmobiliaria = ?
         AND ${enPropiedades}`,
      [idInmobiliaria, ...idsPropiedades]
    ),
  ])

  return { total: Number(conteo[0].total), items: filas }
}

async function incluirImagenes(entidades, conexion = db) {
  if (!entidades.length) return entidades
  const ids = entidades.map((entidad) => entidad.id)
  const inmobiliarias = [...new Set(entidades.map((entidad) => entidad.idInmobiliaria))]
  const [filas] = await conexion.execute(
    `SELECT id, idInmobiliaria, idReporte, nombre FROM reportesImagenes
     WHERE idReporte IN (${ids.map(() => "?").join(", ")})
       AND idInmobiliaria IN (${inmobiliarias.map(() => "?").join(", ")})
     ORDER BY idReporte, id`, [...ids, ...inmobiliarias]
  )
  const porEntidad = new Map(entidades.map((entidad) => [`${entidad.idInmobiliaria}:${entidad.id}`, []]))
  for (const fila of filas) {
    const imagenes = porEntidad.get(`${fila.idInmobiliaria}:${fila.idReporte}`)
    if (imagenes) imagenes.push({ id: fila.id, nombre: fila.nombre,
       url: `/uploads/reportes/${fila.nombre}` })
  }
  return entidades.map((entidad) => ({ ...entidad,
    imagenes: porEntidad.get(`${entidad.idInmobiliaria}:${entidad.id}`) }))
}

async function listarArchivos(entidad, conexion = db) {
  const [filas] = await conexion.execute(
    "SELECT id, nombre FROM reportesImagenes WHERE idReporte = ? AND idInmobiliaria = ? ORDER BY id",
    [entidad.id, entidad.idInmobiliaria]
  )
  return { imagenes: filas.map((imagen) => ({ ...imagen, url: `/uploads/reportes/${imagen.nombre}` })),
    documentos: await listarDocumentos(entidad, conexion) }
}

async function cargarImagenes(entidad, entradas) {
  const nuevas = await guardarLote(entradas, "reportes")
  let conexion
  let confirmado = false
  try {
    conexion = await db.getConnection()
    await conexion.beginTransaction()
    const [filas] = await conexion.execute(
      "SELECT id FROM reportes WHERE id = ? AND idInmobiliaria = ? FOR UPDATE",
      [entidad.id, entidad.idInmobiliaria]
    )
    if (!filas.length) throw problema("NO_ENCONTRADO")
    for (const nueva of nuevas) {
      await conexion.execute(
        "INSERT INTO reportesImagenes (idInmobiliaria, idReporte, nombre) VALUES (?, ?, ?)",
        [entidad.idInmobiliaria, entidad.id, nueva.nombre]
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
    if (!confirmado) await limpiar(nuevas)
  }
}

async function modificarImagen(entidad, idArchivo, entradas) {
  const [nueva] = await guardarLote(entradas, "reportes")
  let conexion
  let confirmado = false
  let anterior
  try {
    conexion = await db.getConnection()
    await conexion.beginTransaction()
    const [filas] = await conexion.execute(
      "SELECT nombre FROM reportesImagenes WHERE id = ? AND idReporte = ? AND idInmobiliaria = ? FOR UPDATE",
      [idArchivo, entidad.id, entidad.idInmobiliaria]
    )
    if (!filas.length) throw problema("NO_ENCONTRADO")
    anterior = filas[0].nombre
    await conexion.execute(
      "UPDATE reportesImagenes SET nombre = ? WHERE id = ? AND idReporte = ? AND idInmobiliaria = ?",
      [nueva.nombre, idArchivo, entidad.id, entidad.idInmobiliaria]
    )
    const resultado = await listarArchivos(entidad, conexion)
    await conexion.commit()
    confirmado = true
    await limpiar([{ destino: "reportes", nombre: anterior }])
    return resultado
  } catch (error) {
    if (conexion && !confirmado) await conexion.rollback()
    throw error
  } finally {
    conexion?.release()
    if (!confirmado) await limpiar([nueva])
  }
}

async function eliminarImagen(entidad, idArchivo) {
  const conexion = await db.getConnection()
  let anterior
  try {
    await conexion.beginTransaction()
    const [filas] = await conexion.execute(
      "SELECT nombre FROM reportesImagenes WHERE id = ? AND idReporte = ? AND idInmobiliaria = ? FOR UPDATE",
      [idArchivo, entidad.id, entidad.idInmobiliaria]
    )
    if (!filas.length) throw problema("NO_ENCONTRADO")
    anterior = filas[0].nombre
    await conexion.execute(
      "DELETE FROM reportesImagenes WHERE id = ? AND idReporte = ? AND idInmobiliaria = ?",
      [idArchivo, entidad.id, entidad.idInmobiliaria]
    )
    await conexion.commit()
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
  await limpiar([{ destino: "reportes", nombre: anterior }])
}

async function prepararEliminacionArchivos(conexion, entidad) {
  const parametros = [entidad.id, entidad.idInmobiliaria]
  const [imagenes] = await conexion.execute(
    "SELECT nombre FROM reportesImagenes WHERE idReporte = ? AND idInmobiliaria = ?", parametros
  )
  const lista = imagenes.map((imagen) => ({ destino: "reportes", nombre: imagen.nombre }))
  await conexion.execute("DELETE FROM reportesImagenes WHERE idReporte = ? AND idInmobiliaria = ?", parametros)
  const [versiones] = await conexion.execute(
    `SELECT v.rutaArchivo FROM versionesDocumentos v INNER JOIN documentos d
     ON d.id = v.idDocumento AND d.idInmobiliaria = v.idInmobiliaria
     WHERE d.idReporte = ? AND d.idInmobiliaria = ?`, parametros
  )
  lista.push(...versiones.map((version) => ({ destino: "documentos", nombre: version.rutaArchivo, privado: true })))
  await conexion.execute(
    `DELETE v FROM versionesDocumentos v INNER JOIN documentos d
     ON d.id = v.idDocumento AND d.idInmobiliaria = v.idInmobiliaria
     WHERE d.idReporte = ? AND d.idInmobiliaria = ?`, parametros
  )
  await conexion.execute("DELETE FROM documentos WHERE idReporte = ? AND idInmobiliaria = ?", parametros)
  return lista
}

async function listarDocumentos(entidad, conexion = db) {
  const [filas] = await conexion.execute(
    `SELECT d.id, d.titulo, d.tipo, v.nombreArchivo, v.mimeType, v.tamanioBytes, v.numeroVersion
     FROM documentos d LEFT JOIN versionesDocumentos v
       ON v.idDocumento = d.id AND v.idInmobiliaria = d.idInmobiliaria
       AND v.numeroVersion = (SELECT MAX(numeroVersion) FROM versionesDocumentos
         WHERE idDocumento = d.id AND idInmobiliaria = d.idInmobiliaria)
     WHERE d.idReporte = ? AND d.idInmobiliaria = ? ORDER BY d.id`,
    [ entidad.id, entidad.idInmobiliaria ]
  )
  return filas
}

async function buscarDocumento(entidad, idArchivo, conexion = db) {
  const [filas] = await conexion.execute(
    `SELECT v.nombreArchivo, v.rutaArchivo, v.mimeType, v.numeroVersion
     FROM documentos d INNER JOIN versionesDocumentos v
       ON v.idDocumento = d.id AND v.idInmobiliaria = d.idInmobiliaria
     WHERE d.id = ? AND d.idReporte = ? AND d.idInmobiliaria = ?
     ORDER BY v.numeroVersion DESC`,
    [idArchivo, entidad.id, entidad.idInmobiliaria]
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
      "SELECT id FROM reportes WHERE id = ? AND idInmobiliaria = ? FOR UPDATE",
      [ entidad.id, entidad.idInmobiliaria ]
    )
    if (!entidades.length) throw problema("NO_ENCONTRADO")
    for (const nuevo of nuevos) {
      const [documento] = await conexion.execute(
        "INSERT INTO documentos (idInmobiliaria, idReporte, titulo, tipo) VALUES (?, ?, ?, 'PDF')",
        [entidad.idInmobiliaria, entidad.id, nuevo.nombreOriginal]
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
      "SELECT id FROM documentos WHERE id = ? AND idReporte = ? AND idInmobiliaria = ? FOR UPDATE",
      [idArchivo, entidad.id, entidad.idInmobiliaria]
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
      "SELECT id FROM documentos WHERE id = ? AND idReporte = ? AND idInmobiliaria = ? FOR UPDATE",
      [idArchivo, entidad.id, entidad.idInmobiliaria]
    )
    if (!documentos.length) throw problema("NO_ENCONTRADO")
    versiones = await buscarDocumento(entidad, idArchivo, conexion)
    await conexion.execute(
      "DELETE FROM versionesDocumentos WHERE idDocumento = ? AND idInmobiliaria = ?",
      [idArchivo, entidad.idInmobiliaria]
    )
    await conexion.execute(
      "DELETE FROM documentos WHERE id = ? AND idReporte = ? AND idInmobiliaria = ?",
      [idArchivo, entidad.id, entidad.idInmobiliaria]
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

module.exports = { listar, buscarPorId, crear, actualizar, eliminar, contarSinResolver, listarSinRevisar, listarDePropiedades , listarArchivos, cargarImagenes, modificarImagen, eliminarImagen, listarDocumentos, buscarDocumento, cargarDocumentos, modificarDocumento, eliminarDocumento}
