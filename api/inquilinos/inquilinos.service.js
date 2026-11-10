const bcrypt = require("bcrypt")
const db = require("../../db/conexion")
const { problema, limpiar, guardarLote } = require("../../utils/adjuntos")
const { crearEnlaceActivacion, crearTokenActivacion } = require("../../utils/activacion")
const { INQUILINO } = require("../../config/roles")
const { saltRounds } = require("../../config/env")

const SELECT_INQUILINO = `
  SELECT
    i.id,
    i.idInmobiliaria,
    i.idPersona,
    i.activo,
    p.nombre,
    p.apellido,
    p.correo,
    p.dni,
    p.telefono,
    p.direccion,
    p.fotoPerfil,
    u.id AS idUsuario,
    u.usuario,
    CASE
      WHEN u.fechaActivacion IS NULL THEN 'PENDIENTE_ACTIVACION'
      ELSE 'ACTIVO'
    END AS estadoCuenta,
    c.id AS idContrato,
    ec.nombre AS estadoContrato,
    prop.nombre AS propiedad,
    prop.ubicacion AS propiedadUbicacion,
    c.fechaInicio,
    c.fechaFin
  FROM inquilinos i
  INNER JOIN personas p
    ON p.id = i.idPersona
    AND p.idInmobiliaria = i.idInmobiliaria
  INNER JOIN usuarios u
    ON u.idPersona = p.id
    AND u.idInmobiliaria = i.idInmobiliaria
  LEFT JOIN contratos c
    ON c.id = (
      SELECT c2.id
      FROM contratosPersonas cp2
      INNER JOIN tiposParticipacion tp2
        ON tp2.id = cp2.idTipoParticipacion
        AND tp2.nombre = 'Inquilino'
      INNER JOIN contratos c2
        ON c2.id = cp2.idContrato
        AND c2.idInmobiliaria = cp2.idInmobiliaria
      INNER JOIN estadosContratos ec2
        ON ec2.id = c2.idEstadoContrato
      WHERE cp2.idInmobiliaria = i.idInmobiliaria
        AND cp2.idPersona = i.idPersona
      ORDER BY (ec2.nombre = 'Vigente') DESC, c2.fechaInicio DESC, c2.id DESC
      LIMIT 1
    )
    AND c.idInmobiliaria = i.idInmobiliaria
  LEFT JOIN estadosContratos ec ON ec.id = c.idEstadoContrato
  LEFT JOIN propiedades prop
    ON prop.id = c.idPropiedad
    AND prop.idInmobiliaria = c.idInmobiliaria
`

function condiciones(inmobiliaria, busqueda) {
  const filtros = ["i.idInmobiliaria = ?", "u.idRol = ?"]
  const parametros = [inmobiliaria, INQUILINO]

  if (busqueda) {
    filtros.push(`(
      p.nombre LIKE ? OR p.apellido LIKE ? OR p.correo LIKE ? OR
      p.dni LIKE ? OR u.usuario LIKE ?
    )`)
    const texto = `%${busqueda}%`
    parametros.push(texto, texto, texto, texto, texto)
  }

  return { filtros: filtros.join(" AND "), parametros }
}

async function buscarInquilino(id, inmobiliaria, conexion = db) {
  const filtro = condiciones(inmobiliaria)
  const [filas] = await conexion.execute(
    `${SELECT_INQUILINO} WHERE i.id = ? AND ${filtro.filtros}`,
    [id, ...filtro.parametros]
  )
  return incluirFotoPerfil(filas[0] || null)
}

async function listar(usuario, query = {}) {
  const filtro = condiciones(usuario.idInmobi, query.q)
  const pagina = Number(query.page || 1)
  const limite = Number(query.limit || 20)
  const offset = (pagina - 1) * limite

  const [filas, conteo] = await Promise.all([
    db.execute(
      `${SELECT_INQUILINO}
       WHERE ${filtro.filtros}
       ORDER BY p.apellido, p.nombre
       LIMIT ? OFFSET ?`,
      [...filtro.parametros, limite, offset]
    ),
    db.execute(
      `SELECT COUNT(*) AS total
       FROM inquilinos i
       INNER JOIN personas p
         ON p.id = i.idPersona
         AND p.idInmobiliaria = i.idInmobiliaria
       INNER JOIN usuarios u
         ON u.idPersona = p.id
         AND u.idInmobiliaria = i.idInmobiliaria
       WHERE ${filtro.filtros}`,
      filtro.parametros
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

async function buscarPorId(usuario, id) {
  return buscarInquilino(id, usuario.idInmobi)
}

async function crear(usuario, cuerpo = {}) {
  const password = await bcrypt.hash(cuerpo.password, saltRounds)
  const activacion = crearTokenActivacion()
  const conexion = await db.getConnection()

  try {
    await conexion.beginTransaction()

    const [persona] = await conexion.execute(
      `INSERT INTO personas
        (idInmobiliaria, nombre, apellido, correo, dni, telefono, direccion)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        usuario.idInmobi,
        cuerpo.nombre,
        cuerpo.apellido,
        cuerpo.correo,
        cuerpo.dni,
        cuerpo.telefono,
        cuerpo.direccion,
      ]
    )

    const [usuarioCreado] = await conexion.execute(
      `INSERT INTO usuarios
        (idInmobiliaria, idPersona, usuario, passwordHash, idRol)
       VALUES (?, ?, ?, ?, ?)`,
      [usuario.idInmobi, persona.insertId, cuerpo.usuario, password, INQUILINO]
    )

    await conexion.execute(
      `INSERT INTO tokensAcceso
        (idUsuario, tokenHash, proposito, fechaExpiracion)
       VALUES (?, ?, 'ACTIVACION', ?)`,
      [usuarioCreado.insertId, activacion.hash, activacion.fechaExpiracion]
    )

    const [inquilino] = await conexion.execute(
      `INSERT INTO inquilinos (idInmobiliaria, idPersona)
       VALUES (?, ?)`,
      [usuario.idInmobi, persona.insertId]
    )

    await conexion.commit()
    return {
      ...(await buscarInquilino(inquilino.insertId, usuario.idInmobi)),
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

async function actualizar(usuario, id, cuerpo = {}) {
  const conexion = await db.getConnection()

  try {
    await conexion.beginTransaction()
    const inquilino = await buscarInquilino(id, usuario.idInmobi, conexion)

    if (!inquilino) {
      await conexion.rollback()
      return null
    }

    const camposPersona = {
      nombre: "nombre",
      apellido: "apellido",
      correo: "correo",
      dni: "dni",
      telefono: "telefono",
      direccion: "direccion",
    }
    const cambiosPersona = Object.entries(camposPersona)
      .filter(([campo]) => Object.prototype.hasOwnProperty.call(cuerpo, campo))

    if (cambiosPersona.length) {
      await conexion.execute(
        `UPDATE personas
         SET ${cambiosPersona.map(([, columna]) => `${columna} = ?`).join(", ")}
         WHERE id = ? AND idInmobiliaria = ?`,
        [...cambiosPersona.map(([campo]) => cuerpo[campo]), inquilino.idPersona, usuario.idInmobi]
      )
    }

    const cambiosUsuario = []
    if (Object.prototype.hasOwnProperty.call(cuerpo, "usuario")) {
      cambiosUsuario.push(["usuario", cuerpo.usuario])
    }
    if (Object.prototype.hasOwnProperty.call(cuerpo, "password")) {
      cambiosUsuario.push(["passwordHash", await bcrypt.hash(cuerpo.password, saltRounds)])
    }

    if (cambiosUsuario.length) {
      await conexion.execute(
        `UPDATE usuarios
         SET ${cambiosUsuario.map(([columna]) => `${columna} = ?`).join(", ")}
         WHERE id = ? AND idInmobiliaria = ? AND idRol = ?`,
        [...cambiosUsuario.map(([, valor]) => valor), inquilino.idUsuario, usuario.idInmobi, INQUILINO]
      )
    }

    if (Object.prototype.hasOwnProperty.call(cuerpo, "activo")) {
      await conexion.execute(
        "UPDATE inquilinos SET activo = ? WHERE id = ? AND idInmobiliaria = ?",
        [cuerpo.activo, id, usuario.idInmobi]
      )
    }

    await conexion.commit()
    return buscarInquilino(id, usuario.idInmobi)
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
    const inquilino = await buscarInquilino(id, usuario.idInmobi, conexion)

    if (!inquilino) {
      await conexion.rollback()
      return false
    }

    const archivosEliminar = await prepararEliminacionArchivos(conexion, inquilino)
    await conexion.execute("DELETE FROM tokensAcceso WHERE idUsuario = ?", [inquilino.idUsuario])
    await conexion.execute(
      "DELETE FROM inquilinos WHERE id = ? AND idInmobiliaria = ?",
      [id, usuario.idInmobi]
    )
    await conexion.execute(
      "DELETE FROM usuarios WHERE id = ? AND idInmobiliaria = ? AND idRol = ?",
      [inquilino.idUsuario, usuario.idInmobi, INQUILINO]
    )
    await conexion.execute(
      "DELETE FROM personas WHERE id = ? AND idInmobiliaria = ?",
      [inquilino.idPersona, usuario.idInmobi]
    )

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

async function contarActivos(idInmobiliaria) {
  const [filas] = await db.execute(
    `SELECT COUNT(*) AS total
     FROM inquilinos i
     WHERE i.idInmobiliaria = ?
       AND i.activo = TRUE`,
    [idInmobiliaria]
  )
  return Number(filas[0].total)
}

async function personaDelUsuario(idUsuario, idInmobiliaria) {
  const [filas] = await db.execute(
    `SELECT i.idPersona
     FROM inquilinos i
     INNER JOIN usuarios u
       ON u.idPersona = i.idPersona
       AND u.idInmobiliaria = i.idInmobiliaria
     WHERE u.id = ?
       AND i.idInmobiliaria = ?`,
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

module.exports = { listar, buscarPorId, crear, actualizar, eliminar, contarActivos, personaDelUsuario , listarArchivos, cargarFoto, eliminarFoto, listarDocumentos, buscarDocumento, cargarDocumentos, modificarDocumento, eliminarDocumento}
