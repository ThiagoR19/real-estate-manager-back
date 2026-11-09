const bcrypt = require("bcrypt")
const db = require("../../db/conexion")
const adjuntos = require("../archivos/archivos.service")
const { crearEnlaceActivacion, crearTokenActivacion } = require("../../utils/activacion")
const { SUPERADMIN, ADMIN, AGENTE } = require("../../config/roles")
const { saltRounds } = require("../../config/env")

const SELECT_AGENTE = `
  SELECT
    a.id,
    a.idInmobiliaria,
    a.idPersona,
    a.idArea,
    ar.nombre AS area,
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
  return filas[0] || null
}

async function listar(usuario, query = {}) {
  const condiciones = filtro(usuario, query.idInmobiliaria, query.q)
  const pagina = Number(query.page || 1)
  const limite = Number(query.limit || 20)
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
    items: filas[0],
    paginacion: { pagina, limite, total, paginas: Math.ceil(total / limite) },
  }
}

async function crear(usuario, cuerpo = {}) {
  const idInmobiliaria = inmobiliaria(usuario, cuerpo.idInmobiliaria)
  const password = await bcrypt.hash(cuerpo.password, saltRounds)
  const activacion = crearTokenActivacion()
  const conexion = await db.getConnection()

  try {
    await conexion.beginTransaction()

    const [persona] = await conexion.execute(`INSERT INTO personas (idInmobiliaria, nombre, apellido, correo, dni, telefono, direccion) VALUES (?, ?, ?, ?, ?, ?, ?)`, [idInmobiliaria, cuerpo.nombre, cuerpo.apellido, cuerpo.correo, cuerpo.dni, cuerpo.telefono, cuerpo.direccion])

    const [usuarioCreado] = await conexion.execute(`INSERT INTO usuarios (idInmobiliaria, idPersona, usuario, passwordHash, idRol) VALUES (?, ?, ?, ?, ?)`, [idInmobiliaria, persona.insertId, cuerpo.usuario, password, AGENTE])

    const [agente] = await conexion.execute(`INSERT INTO agentes (idInmobiliaria, idPersona, idArea) VALUES (?, ?, ?)`, [idInmobiliaria, persona.insertId, cuerpo.idArea])

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
      dni: "dni",
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

    const cambiosUsuario = []
    if (Object.hasOwn(cuerpo, "usuario")) cambiosUsuario.push(["usuario", cuerpo.usuario])
    if (Object.hasOwn(cuerpo, "password")) {
      cambiosUsuario.push(["passwordHash", await bcrypt.hash(cuerpo.password, saltRounds)])
    }

    if (cambiosUsuario.length) {
      await conexion.execute(
        `UPDATE usuarios
         SET ${cambiosUsuario.map(([columna]) => `\`${columna}\` = ?`).join(", ")}
         WHERE id = ? AND idInmobiliaria = ?`,
        [...cambiosUsuario.map(([, valor]) => valor), agente.idUsuario, agente.idInmobiliaria]
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

  const [resultado] = await db.execute(
    `UPDATE usuarios u
     INNER JOIN agentes a
       ON a.idPersona = u.idPersona
       AND a.idInmobiliaria = u.idInmobiliaria
     SET u.idRol = ?
     WHERE a.id = ? AND ${condiciones.join(" AND ")}`,
    [nuevoRol, id, ...parametros]
  )
  return { id, rol: nuevoRol, afectados: resultado.affectedRows }
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
    const archivosEliminar = await adjuntos.prepararEliminacion(conexion, "persona", agente)
    await conexion.execute("DELETE FROM tokensAcceso WHERE idUsuario = ?", [agente.idUsuario])
    await conexion.execute("DELETE FROM agentes WHERE id = ? AND idInmobiliaria = ?", [id, agente.idInmobiliaria])
    await conexion.execute("DELETE FROM usuarios WHERE id = ? AND idInmobiliaria = ?", [agente.idUsuario, agente.idInmobiliaria])
    await conexion.execute("DELETE FROM personas WHERE id = ? AND idInmobiliaria = ?", [agente.idPersona, agente.idInmobiliaria])
    await conexion.commit()
    await adjuntos.limpiar(archivosEliminar)
    return true
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}

module.exports = { listar, buscarPorId, crear, actualizar, cambiarRol, eliminar }
