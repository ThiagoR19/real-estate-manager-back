const db = require("../../db/conexion")
const { limpiar, guardarLote } = require("../../utils/adjuntos")
const { problema } = require("../../utils/res")
const { crearEnlaceActivacion, crearTokenActivacion } = require("../../utils/activacion")
const { ADMIN, AGENTE } = require("../../config/roles")
const { desconectarUsuario } = require("../../sockets/sockets")
const { avisarAlta } = require("../notificaciones/notificaciones.cuentas")

const SELECT_ADMIN = ` SELECT u.id, u.idInmobiliaria, p.id AS idPersona, p.nombre, p.apellido, p.correo, p.dni, p.telefono, p.direccion, p.fotoPerfil, u.usuario,
  CASE WHEN u.fechaActivacion IS NULL THEN 'PENDIENTE_ACTIVACION' ELSE 'ACTIVO' END AS estadoCuenta
  FROM usuarios u INNER JOIN personas p ON p.id = u.idPersona AND (p.idInmobiliaria <=> u.idInmobiliaria)`

async function buscarAdmin(id, conexion = db) {
  const [filas] = await conexion.execute(
    `${SELECT_ADMIN} WHERE u.id = ? AND u.idRol = ?`,
    [id, ADMIN]
  )
  return incluirFotoPerfil(filas[0] || null)
}

async function listar(query = {}) {
  const pagina = Number(query.page || 1)
  const limite = Number(query.limit || 10)
  const [admins] = await db.execute(
    `${SELECT_ADMIN} WHERE u.idRol = ? ORDER BY p.apellido, p.nombre, u.id LIMIT ? OFFSET ?`,
    [ADMIN, limite, (pagina - 1) * limite]
  )
  const [conteo] = await db.execute("SELECT COUNT(*) AS total FROM usuarios WHERE idRol = ?", [ADMIN])
  const total = Number(conteo[0].total)
  return { items: admins.map(incluirFotoPerfil), paginacion: { pagina, limite, total, paginas: Math.ceil(total / limite) } }
}

async function crear(cuerpo = {}) {
  const activacion = crearTokenActivacion()
  const conexion = await db.getConnection()

  try {
    await conexion.beginTransaction()

    const [persona] = await conexion.execute(
      `INSERT INTO personas
        (idInmobiliaria, nombre, apellido, correo, dni, telefono, direccion)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        cuerpo.idInmobiliaria,
        cuerpo.nombre ?? null,
        cuerpo.apellido ?? null,
        cuerpo.correo ?? null,
        cuerpo.dni,
        cuerpo.telefono ?? null,
        cuerpo.direccion ?? null,
      ]
    )

    const [usuario] = await conexion.execute(
      `INSERT INTO usuarios
        (idInmobiliaria, idPersona, idRol)
       VALUES (?, ?, ?)`,
      [cuerpo.idInmobiliaria, persona.insertId, ADMIN]
    )

    await conexion.execute(
      `INSERT INTO tokensAcceso
        (idUsuario, tokenHash, proposito, fechaExpiracion)
       VALUES (?, ?, 'ACTIVACION', ?)`,
      [usuario.insertId, activacion.hash, activacion.fechaExpiracion]
    )

    await avisarAlta(conexion, cuerpo.idInmobiliaria, ADMIN, cuerpo)
    await conexion.commit()
    return {
      ...(await buscarAdmin(usuario.insertId)),
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

async function generarEnlaceActivacion(id) {
  const conexion = await db.getConnection()

  try {
    await conexion.beginTransaction()
    const [filas] = await conexion.execute(
      "SELECT id AS idUsuario, fechaActivacion FROM usuarios WHERE id = ? AND idRol = ? FOR UPDATE",
      [id, ADMIN]
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

async function eliminar(id) {
  const conexion = await db.getConnection()
  try {
    await conexion.beginTransaction()
    const [filas] = await conexion.execute(`SELECT u.id, u.idPersona, u.idInmobiliaria FROM usuarios u WHERE u.id = ? AND u.idRol = ?`, [id, ADMIN])
    if (!filas.length) { await conexion.rollback(); return false }
    const admin = filas[0]
    const [documentos] = await conexion.execute(
      "SELECT 1 FROM documentos WHERE idPersona = ? AND idInmobiliaria = ? LIMIT 1",
      [admin.idPersona, admin.idInmobiliaria]
    )
    if (documentos.length) {
      throw problema("CONFLICTO", "No se puede eliminar porque el administrador tiene documentos")
    }
    const archivosEliminar = await prepararEliminacionArchivos(conexion, admin)
    // Keep document version history while allowing the admin account to be removed.
    await conexion.execute(
      "UPDATE versionesDocumentos SET idUsuarioAutor = NULL WHERE idInmobiliaria = ? AND idUsuarioAutor = ?",
      [admin.idInmobiliaria, admin.id]
    )
    await conexion.execute(`DELETE FROM tokensAcceso WHERE idUsuario = ?`, [admin.id])
    await conexion.execute(`DELETE FROM usuarios WHERE id = ?`, [admin.id])
    await conexion.execute(`DELETE FROM agentes WHERE idPersona = ?`, [admin.idPersona])
    await conexion.execute(`DELETE FROM personas WHERE id = ?`, [admin.idPersona])
    await conexion.commit()
    await limpiar(archivosEliminar)
    desconectarUsuario(admin.id)
    return true
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}


async function pasarAAgente(id) {
  const conexion = await db.getConnection()
  try {
    await conexion.beginTransaction()
    const [filas] = await conexion.execute(
      `SELECT u.id, u.idPersona, u.idInmobiliaria FROM usuarios u WHERE u.id = ? AND u.idRol = ? FOR UPDATE`,
      [id, ADMIN]
    )
    if (!filas.length || filas[0].idInmobiliaria === null) { await conexion.rollback(); return null }
    const admin = filas[0]

    await conexion.execute(`UPDATE usuarios SET idRol = ? WHERE id = ?`, [AGENTE, admin.id])

    const [agentes] = await conexion.execute(`SELECT id FROM agentes WHERE idPersona = ?`, [admin.idPersona])
    let idAgente = agentes[0]?.id
    if (!idAgente) {
      const [agente] = await conexion.execute(
        `INSERT INTO agentes (idInmobiliaria, idPersona, idArea) VALUES (?, ?, NULL)`,
        [admin.idInmobiliaria, admin.idPersona]
      )
      idAgente = agente.insertId
    }

    await conexion.commit()
    desconectarUsuario(admin.id)
    return { id: admin.id, idAgente, rol: "AGENTE" }
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
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
  return {
    fotoPerfil: filas[0].fotoPerfil || null,
    urlFotoPerfil: filas[0].fotoPerfil ? `/uploads/perfiles/${filas[0].fotoPerfil}` : null
  }
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

module.exports = { listar, crear, generarEnlaceActivacion, eliminar, pasarAAgente, buscarAdmin, listarArchivos, cargarFoto, eliminarFoto }
