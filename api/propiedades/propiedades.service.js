const db = require("../../db/conexion")
const { problema, limpiar, guardarLote } = require("../../utils/adjuntos")

async function catalogos(usuario) {
  const [tipos, estados, agentes] = await Promise.all([
    db.execute("SELECT id, nombre FROM tiposPropiedades ORDER BY nombre"),
    db.execute("SELECT id, nombre FROM estadosComerciales ORDER BY id"),
    db.execute(`SELECT a.id, CONCAT(p.nombre, ' ', p.apellido) AS nombre
      FROM agentes a INNER JOIN personas p ON p.id = a.idPersona AND p.idInmobiliaria = a.idInmobiliaria
      WHERE a.idInmobiliaria = ? ORDER BY p.apellido, p.nombre`, [usuario.idInmobi]),
  ])
  return { tipos: tipos[0], estados: estados[0], agentes: agentes[0] }
}

const SELECT_PROPIEDAD = `
  SELECT
    p.id,
    p.idInmobiliaria,
    p.idEstadoComercial,
    ec.nombre AS estadoComercial,
    p.idTipo,
    tp.nombre AS tipo,
    p.idAgente,
    p.nombre,
    p.descripcion,
    p.ubicacion,
    p.precio,
    p.moneda,
    p.publicada,
    p.tamanio AS tamano,
    p.antiguedad,
    p.banios AS banos,
    p.habitaciones,
    p.fechaCreacion
  FROM propiedades p
  INNER JOIN estadosComerciales ec ON ec.id = p.idEstadoComercial
  INNER JOIN tiposPropiedades tp ON tp.id = p.idTipo
`

function alcance(usuario, valor) {
  if (usuario && usuario.idInmobi !== undefined) {
    return usuario.idInmobi
  }
  return valor
}

function condiciones(usuario, valorInmobiliaria, busqueda) {
  const inmobiliaria = alcance(usuario, valorInmobiliaria)

  const filtros = []
  const parametros = []

  if (inmobiliaria !== undefined && inmobiliaria !== null) {
    filtros.push("p.idInmobiliaria = ?")
    parametros.push(inmobiliaria)
  }

  if (busqueda) {
    filtros.push("(p.nombre LIKE ? OR p.ubicacion LIKE ? OR p.descripcion LIKE ?)")
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
  const limite = Number(query.limit || 20)
  const offset = (pagina - 1) * limite

  const [filas, conteo] = await Promise.all([
    db.execute(
      `${SELECT_PROPIEDAD}
       ${filtro.sql}
       ORDER BY p.fechaCreacion DESC
       LIMIT ? OFFSET ?`,
      [...filtro.parametros, limite, offset]
    ),
    db.execute(
      `SELECT COUNT(*) AS total
       FROM propiedades p
       ${filtro.sql}`,
      filtro.parametros
    ),
  ])

  const total = Number(conteo[0][0].total)
  const items = await incluirImagenes(filas[0])
  return {
    items,
    paginacion: {
      pagina,
      limite,
      total,
      paginas: Math.ceil(total / limite),
    },
  }
}

async function buscarPorId(usuario, id) {
  const filtro = condiciones(usuario, undefined, undefined)
  const where = filtro.sql ? `${filtro.sql} AND p.id = ?` : " WHERE p.id = ?"

  const [filas] = await db.execute(
    `${SELECT_PROPIEDAD}${where}`,
    [...filtro.parametros, id]
  )

  if (!filas.length) return null
  const [propiedad] = await incluirImagenes(filas)
  return propiedad
}

async function crear(usuario, cuerpo = {}) {
  const inmobiliaria = alcance(usuario, cuerpo.idInmobiliaria)
  const [resultado] = await db.execute(
    `INSERT INTO propiedades
      (idInmobiliaria, idEstadoComercial, idTipo, idAgente,
       nombre, descripcion, ubicacion, precio, moneda, publicada,
       tamanio, antiguedad, banios, habitaciones)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      inmobiliaria,
      cuerpo.idEstadoComercial,
      cuerpo.idTipo,
      cuerpo.idAgente ?? null,
      cuerpo.nombre,
      cuerpo.descripcion ?? null,
      cuerpo.ubicacion ?? null,
      cuerpo.precio ?? null,
      cuerpo.moneda ?? "ARS",
      cuerpo.publicada ?? false,
      cuerpo.tamano ?? null,
      cuerpo.antiguedad ?? null,
      cuerpo.banos ?? null,
      cuerpo.habitaciones ?? null,
    ]
  )

  return buscarPorId(usuario, resultado.insertId)
}

async function actualizar(usuario, id, cuerpo = {}) {
  const campos = {
    idEstadoComercial: "idEstadoComercial",
    idTipo: "idTipo",
    idAgente: "idAgente",
    nombre: "nombre",
    descripcion: "descripcion",
    ubicacion: "ubicacion",
    precio: "precio",
    moneda: "moneda",
    publicada: "publicada",
    tamano: "tamanio",
    antiguedad: "antiguedad",
    banos: "banios",
    habitaciones: "habitaciones",
  }
  const cambios = Object.entries(campos).filter(([campo]) => Object.prototype.hasOwnProperty.call(cuerpo, campo))
  const inmobiliaria = alcance(usuario)
  const parametros = cambios.map(([campo]) => cuerpo[campo])
  const where = ["id = ?"]
  parametros.push(id)

  if (inmobiliaria !== undefined && inmobiliaria !== null) { where.push("idInmobiliaria = ?"); parametros.push(inmobiliaria) }

  if (cambios.length) {
    await db.execute(`UPDATE propiedades SET ${cambios.map(([, columna]) => `\`${columna}\` = ?`).join(", ")} WHERE ${where.join(" AND ")}`, parametros)
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
    const [filas] = await conexion.execute(`SELECT id, idInmobiliaria FROM propiedades WHERE ${where.join(" AND ")} FOR UPDATE`, parametros)
    if (!filas.length) { await conexion.rollback(); return false }
    const archivosEliminar = await prepararEliminacionArchivos(conexion, filas[0])
    await conexion.execute(`DELETE FROM propiedades WHERE ${where.join(" AND ")}`, parametros)
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

async function contarPorEstado(idInmobiliaria) {
  const [filas] = await db.execute(
    `SELECT
       ec.nombre AS estado,
       COUNT(*) AS total
     FROM propiedades p
     INNER JOIN estadosComerciales ec ON ec.id = p.idEstadoComercial
     WHERE p.idInmobiliaria = ?
     GROUP BY ec.nombre`,
    [idInmobiliaria]
  )

  const porEstado = Object.fromEntries(filas.map((fila) => [fila.estado, Number(fila.total)]))
  return {
    total: filas.reduce((suma, fila) => suma + Number(fila.total), 0),
    disponibles: porEstado.Disponible ?? 0,
    reservadas: porEstado.Reservada ?? 0,
    alquiladas: porEstado.Alquilada ?? 0,
    vendidas: porEstado.Vendida ?? 0,
    inactivas: porEstado.Inactiva ?? 0,
  }
}

async function listarDePropietario(idInmobiliaria, idPersona) {
  const [filas] = await db.execute(
    `SELECT
       p.id,
       p.nombre,
       p.ubicacion,
       ec.nombre AS estadoComercial,
       p.precio,
       p.moneda,
       p.idAgente
     FROM propiedades p
     INNER JOIN estadosComerciales ec ON ec.id = p.idEstadoComercial
     INNER JOIN propiedadesPersonas pp
       ON pp.idPropiedad = p.id
       AND pp.idInmobiliaria = p.idInmobiliaria
     INNER JOIN tiposParticipacion tp ON tp.id = pp.idTipoParticipacion
     WHERE p.idInmobiliaria = ?
       AND pp.idPersona = ?
       AND tp.nombre = 'Propietario'
     ORDER BY p.nombre, p.id`,
    [idInmobiliaria, idPersona]
  )
  return filas.map((fila) => ({ ...fila, precio: fila.precio === null ? null : Number(fila.precio) }))
}

async function incluirImagenes(entidades, conexion = db) {
  if (!entidades.length) return entidades
  const ids = entidades.map((entidad) => entidad.id)
  const inmobiliarias = [...new Set(entidades.map((entidad) => entidad.idInmobiliaria))]
  const [filas] = await conexion.execute(
    `SELECT id, idInmobiliaria, idPropiedad, nombre, orden FROM propiedadesImagenes
     WHERE idPropiedad IN (${ids.map(() => "?").join(", ")})
       AND idInmobiliaria IN (${inmobiliarias.map(() => "?").join(", ")})
     ORDER BY idPropiedad, orden, id`, [...ids, ...inmobiliarias]
  )
  const porEntidad = new Map(entidades.map((entidad) => [`${entidad.idInmobiliaria}:${entidad.id}`, []]))
  for (const fila of filas) {
    const imagenes = porEntidad.get(`${fila.idInmobiliaria}:${fila.idPropiedad}`)
    if (imagenes) imagenes.push({ id: fila.id, nombre: fila.nombre,
      orden: fila.orden, url: `/uploads/propiedades/${fila.nombre}` })
  }
  return entidades.map((entidad) => ({ ...entidad,
    imagenes: porEntidad.get(`${entidad.idInmobiliaria}:${entidad.id}`) }))
}

async function listarArchivos(entidad, conexion = db) {
  const [filas] = await conexion.execute(
    "SELECT id, nombre, orden FROM propiedadesImagenes WHERE idPropiedad = ? AND idInmobiliaria = ? ORDER BY orden, id",
    [entidad.id, entidad.idInmobiliaria]
  )
  return { imagenes: filas.map((imagen) => ({ ...imagen, url: `/uploads/propiedades/${imagen.nombre}` })),
    documentos: await listarDocumentos(entidad, conexion) }
}

async function cargarImagenes(entidad, entradas) {
  const nuevas = await guardarLote(entradas, "propiedades")
  let conexion
  let confirmado = false
  try {
    conexion = await db.getConnection()
    await conexion.beginTransaction()
    const [filas] = await conexion.execute(
      "SELECT id FROM propiedades WHERE id = ? AND idInmobiliaria = ? FOR UPDATE",
      [entidad.id, entidad.idInmobiliaria]
    )
    if (!filas.length) throw problema("NO_ENCONTRADO")
    const [ordenes] = await conexion.execute(
      "SELECT COALESCE(MAX(orden), -1) + 1 AS siguiente FROM propiedadesImagenes WHERE idPropiedad = ? AND idInmobiliaria = ?",
      [entidad.id, entidad.idInmobiliaria]
    )
    let orden = Number(ordenes[0].siguiente)
    for (const nueva of nuevas) {
      await conexion.execute(
        "INSERT INTO propiedadesImagenes (idInmobiliaria, idPropiedad, nombre, orden) VALUES (?, ?, ?, ?)",
        [entidad.idInmobiliaria, entidad.id, nueva.nombre, orden++]
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
  const [nueva] = await guardarLote(entradas, "propiedades")
  let conexion
  let confirmado = false
  let anterior
  try {
    conexion = await db.getConnection()
    await conexion.beginTransaction()
    const [filas] = await conexion.execute(
      "SELECT nombre FROM propiedadesImagenes WHERE id = ? AND idPropiedad = ? AND idInmobiliaria = ? FOR UPDATE",
      [idArchivo, entidad.id, entidad.idInmobiliaria]
    )
    if (!filas.length) throw problema("NO_ENCONTRADO")
    anterior = filas[0].nombre
    await conexion.execute(
      "UPDATE propiedadesImagenes SET nombre = ? WHERE id = ? AND idPropiedad = ? AND idInmobiliaria = ?",
      [nueva.nombre, idArchivo, entidad.id, entidad.idInmobiliaria]
    )
    const resultado = await listarArchivos(entidad, conexion)
    await conexion.commit()
    confirmado = true
    await limpiar([{ destino: "propiedades", nombre: anterior }])
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
      "SELECT nombre FROM propiedadesImagenes WHERE id = ? AND idPropiedad = ? AND idInmobiliaria = ? FOR UPDATE",
      [idArchivo, entidad.id, entidad.idInmobiliaria]
    )
    if (!filas.length) throw problema("NO_ENCONTRADO")
    anterior = filas[0].nombre
    await conexion.execute(
      "DELETE FROM propiedadesImagenes WHERE id = ? AND idPropiedad = ? AND idInmobiliaria = ?",
      [idArchivo, entidad.id, entidad.idInmobiliaria]
    )
    await conexion.commit()
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
  await limpiar([{ destino: "propiedades", nombre: anterior }])
}

async function prepararEliminacionArchivos(conexion, entidad) {
  const parametros = [entidad.id, entidad.idInmobiliaria]
  const [imagenes] = await conexion.execute(
    "SELECT nombre FROM propiedadesImagenes WHERE idPropiedad = ? AND idInmobiliaria = ?", parametros
  )
  const lista = imagenes.map((imagen) => ({ destino: "propiedades", nombre: imagen.nombre }))
  await conexion.execute("DELETE FROM propiedadesImagenes WHERE idPropiedad = ? AND idInmobiliaria = ?", parametros)
  const [versiones] = await conexion.execute(
    `SELECT v.rutaArchivo FROM versionesDocumentos v INNER JOIN documentos d
     ON d.id = v.idDocumento AND d.idInmobiliaria = v.idInmobiliaria
     WHERE d.idPropiedad = ? AND d.idInmobiliaria = ?`, parametros
  )
  lista.push(...versiones.map((version) => ({ destino: "documentos", nombre: version.rutaArchivo, privado: true })))
  await conexion.execute(
    `DELETE v FROM versionesDocumentos v INNER JOIN documentos d
     ON d.id = v.idDocumento AND d.idInmobiliaria = v.idInmobiliaria
     WHERE d.idPropiedad = ? AND d.idInmobiliaria = ?`, parametros
  )
  await conexion.execute("DELETE FROM documentos WHERE idPropiedad = ? AND idInmobiliaria = ?", parametros)
  return lista
}

async function listarDocumentos(entidad, conexion = db) {
  const [filas] = await conexion.execute(
    `SELECT d.id, d.titulo, d.tipo, v.nombreArchivo, v.mimeType, v.tamanioBytes, v.numeroVersion
     FROM documentos d LEFT JOIN versionesDocumentos v
       ON v.idDocumento = d.id AND v.idInmobiliaria = d.idInmobiliaria
       AND v.numeroVersion = (SELECT MAX(numeroVersion) FROM versionesDocumentos
         WHERE idDocumento = d.id AND idInmobiliaria = d.idInmobiliaria)
     WHERE d.idPropiedad = ? AND d.idInmobiliaria = ? ORDER BY d.id`,
    [ entidad.id, entidad.idInmobiliaria ]
  )
  return filas
}

async function buscarDocumento(entidad, idArchivo, conexion = db) {
  const [filas] = await conexion.execute(
    `SELECT v.nombreArchivo, v.rutaArchivo, v.mimeType, v.numeroVersion
     FROM documentos d INNER JOIN versionesDocumentos v
       ON v.idDocumento = d.id AND v.idInmobiliaria = d.idInmobiliaria
     WHERE d.id = ? AND d.idPropiedad = ? AND d.idInmobiliaria = ?
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
      "SELECT id FROM propiedades WHERE id = ? AND idInmobiliaria = ? FOR UPDATE",
      [ entidad.id, entidad.idInmobiliaria ]
    )
    if (!entidades.length) throw problema("NO_ENCONTRADO")
    for (const nuevo of nuevos) {
      const [documento] = await conexion.execute(
        "INSERT INTO documentos (idInmobiliaria, idPropiedad, titulo, tipo) VALUES (?, ?, ?, 'PDF')",
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
      "SELECT id FROM documentos WHERE id = ? AND idPropiedad = ? AND idInmobiliaria = ? FOR UPDATE",
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
      "SELECT id FROM documentos WHERE id = ? AND idPropiedad = ? AND idInmobiliaria = ? FOR UPDATE",
      [idArchivo, entidad.id, entidad.idInmobiliaria]
    )
    if (!documentos.length) throw problema("NO_ENCONTRADO")
    versiones = await buscarDocumento(entidad, idArchivo, conexion)
    await conexion.execute(
      "DELETE FROM versionesDocumentos WHERE idDocumento = ? AND idInmobiliaria = ?",
      [idArchivo, entidad.idInmobiliaria]
    )
    await conexion.execute(
      "DELETE FROM documentos WHERE id = ? AND idPropiedad = ? AND idInmobiliaria = ?",
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

module.exports = { catalogos, listar, buscarPorId, crear, actualizar, eliminar, contarPorEstado, listarDePropietario , listarArchivos, cargarImagenes, modificarImagen, eliminarImagen, listarDocumentos, buscarDocumento, cargarDocumentos, modificarDocumento, eliminarDocumento}
