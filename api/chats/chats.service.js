const db = require("../../db/conexion")
const { z } = require("zod")
const { ADMIN, AGENTE, PROPIETARIO, INQUILINO } = require("../../config/roles")

const usuarioSchema = z.object({
  id: z.coerce.number().int().positive(),
})
const idSchema = z.coerce.number().int().positive()

const ROLES_CHAT = [ADMIN, AGENTE, PROPIETARIO, INQUILINO]
const ROLES_PERSONAL = [ADMIN, AGENTE]
const LIMITE_BUSQUEDA = 50

const puedenConversar = (rolA, rolB) =>
  ROLES_CHAT.includes(rolA) && ROLES_CHAT.includes(rolB) &&
  (ROLES_PERSONAL.includes(rolA) || ROLES_PERSONAL.includes(rolB))

const rolesContactables = (rol) => ROLES_PERSONAL.includes(rol) ? ROLES_CHAT : ROLES_PERSONAL

const like = (texto) => `%${texto.replace(/[\\%_]/g, (caracter) => `\\${caracter}`)}%`

const marcadores = (lista) => lista.map(() => "?").join(", ")

const SELECT_USUARIO = `
  SELECT
    u.id,
    u.idPersona,
    u.idInmobiliaria,
    u.idRol,
    u.fechaActivacion,
    p.nombre,
    p.apellido
  FROM usuarios u
  INNER JOIN personas p
    ON p.id = u.idPersona
`

// LEFT JOIN con el otro participante: si fue eliminado, la conversación se sigue viendo como "Usuario eliminado"
const SELECT_CONVERSACION = `
  SELECT
    c.id,
    c.idInmobiliaria,
    c.fechaCreacion,
    otro.id AS idPersona,
    ou.id AS idUsuario,
    COALESCE(otro.nombre, 'Usuario') AS nombre,
    COALESCE(otro.apellido, 'eliminado') AS apellido,
    r.nombre AS rol,
    um.contenido AS ultimoMensaje,
    um.fecha AS fechaUltimoMensaje,
    ce.fechaUltimaLectura,
    (
      SELECT COUNT(*)
      FROM mensajes m
      WHERE m.idConversacion = c.id
        AND m.idInmobiliaria = c.idInmobiliaria
        AND NOT (m.idPersona <=> u.idPersona)
        AND (ce.fechaUltimaLectura IS NULL OR m.fecha > ce.fechaUltimaLectura)
    ) AS noLeidos
  FROM usuarios u
  INNER JOIN conversaciones c
    ON c.idInmobiliaria = u.idInmobiliaria
    AND u.idPersona IN (c.idPersona1, c.idPersona2)
  LEFT JOIN personas otro
    ON otro.idInmobiliaria = c.idInmobiliaria
    AND otro.id = IF(c.idPersona1 <=> u.idPersona, c.idPersona2, c.idPersona1)
  LEFT JOIN usuarios ou
    ON ou.idPersona = otro.id
    AND ou.idInmobiliaria = c.idInmobiliaria
  LEFT JOIN roles r
    ON r.id = ou.idRol
  LEFT JOIN conversacionesEstado ce
    ON ce.idConversacion = c.id
    AND ce.idInmobiliaria = c.idInmobiliaria
    AND ce.idPersona = u.idPersona
  LEFT JOIN mensajes um
    ON um.id = (
      SELECT m2.id
      FROM mensajes m2
      WHERE m2.idConversacion = c.id
        AND m2.idInmobiliaria = c.idInmobiliaria
      ORDER BY m2.fecha DESC, m2.id DESC
      LIMIT 1
    )
`

const ORDEN_CONVERSACIONES = `ORDER BY COALESCE(um.fecha, c.fechaCreacion) DESC, c.id DESC`

const SELECT_MENSAJE = `
  SELECT
    m.id,
    m.idInmobiliaria,
    m.idConversacion,
    m.idPersona,
    ur.id AS idUsuario,
    COALESCE(p.nombre, 'Usuario') AS nombre,
    COALESCE(p.apellido, 'eliminado') AS apellido,
    m.contenido,
    m.fecha
  FROM mensajes m
  LEFT JOIN personas p
    ON p.id = m.idPersona
    AND p.idInmobiliaria = m.idInmobiliaria
  LEFT JOIN usuarios ur
    ON ur.idPersona = m.idPersona
    AND ur.idInmobiliaria = m.idInmobiliaria
`

const normalizarConversacion = (fila) => ({ ...fila, noLeidos: Number(fila.noLeidos) })

async function obtenerUsuario(idUsuario) {
  const [filas] = await db.execute(`${SELECT_USUARIO} WHERE u.id = ?`, [idUsuario])
  return filas[0] || null
}

async function agregarAdjuntos(mensajes) {
  if (!mensajes.length) {
    return mensajes
  }

  const ids = mensajes.map((mensaje) => mensaje.id)
  const [adjuntos] = await db.execute(
    `SELECT
       a.id,
       a.idMensaje,
       a.nombreArchivo,
       a.mimeType,
       a.tamanioBytes
     FROM mensajesAdjuntos a
     WHERE a.idInmobiliaria = ?
       AND a.idMensaje IN (${marcadores(ids)})
     ORDER BY a.id`,
    [mensajes[0].idInmobiliaria, ...ids]
  )

  return mensajes.map(({ idInmobiliaria, ...mensaje }) => ({
    ...mensaje,
    adjuntos: adjuntos
      .filter((adjunto) => adjunto.idMensaje === mensaje.id)
      .map(({ idMensaje, ...adjunto }) => ({ ...adjunto, tamanioBytes: Number(adjunto.tamanioBytes) })),
  }))
}

async function obtenerMensaje(idMensaje, idInmobiliaria) {
  const [filas] = await db.execute(
    `${SELECT_MENSAJE} WHERE m.id = ? AND m.idInmobiliaria = ?`,
    [idMensaje, idInmobiliaria]
  )
  const [mensaje] = await agregarAdjuntos(filas)
  return mensaje || null
}

async function listar(idUsuario, filtros = {}) {
  const condiciones = ["u.id = ?"]
  const parametros = [idUsuario]

  if (filtros.q) {
    condiciones.push(`(
      CONCAT(otro.nombre, ' ', otro.apellido) LIKE ?
      OR EXISTS (
        SELECT 1
        FROM mensajes mq
        WHERE mq.idConversacion = c.id
          AND mq.idInmobiliaria = c.idInmobiliaria
          AND mq.contenido LIKE ?
      )
    )`)
    parametros.push(like(filtros.q), like(filtros.q))
  }

  const [filas] = await db.execute(
    `${SELECT_CONVERSACION} WHERE ${condiciones.join(" AND ")} ${ORDEN_CONVERSACIONES}`,
    parametros
  )
  return filas.map(normalizarConversacion)
}

async function buscarConversacion(idUsuario, idConversacion) {
  const [filas] = await db.execute(
    `${SELECT_CONVERSACION} WHERE u.id = ? AND c.id = ?`,
    [idUsuario, idConversacion]
  )
  return filas[0] ? normalizarConversacion(filas[0]) : null
}

async function esParticipante(usuario, idConversacion, idInmobiliaria) {
  const { id: idUsuario } = usuarioSchema.parse(usuario)
  const conversacion = idSchema.parse(idConversacion)
  const inmobiliaria = idSchema.parse(idInmobiliaria)
  const [filas] = await db.execute(
    `SELECT c.id
     FROM conversaciones c
     INNER JOIN usuarios u
       ON u.idInmobiliaria = c.idInmobiliaria
       AND u.idPersona IN (c.idPersona1, c.idPersona2)
     WHERE c.id = ?
       AND u.id = ?
       AND c.idInmobiliaria = ?
     LIMIT 1`,
    [conversacion, idUsuario, inmobiliaria]
  )

  return filas.length > 0
}

async function contactos(idUsuario, filtros = {}) {
  const usuario = await obtenerUsuario(idUsuario)
  if (!usuario) {
    return []
  }

  const roles = rolesContactables(usuario.idRol)
  const condiciones = [
    "u.idInmobiliaria = ?",
    "u.id <> ?",
    "u.fechaActivacion IS NOT NULL",
    `u.idRol IN (${marcadores(roles)})`,
  ]
  const parametros = [usuario.idInmobiliaria, usuario.id, ...roles]

  if (filtros.q) {
    condiciones.push("CONCAT(p.nombre, ' ', p.apellido) LIKE ?")
    parametros.push(like(filtros.q))
  }

  const [filas] = await db.execute(
    `SELECT
       u.id AS idUsuario,
       u.idPersona,
       p.nombre,
       p.apellido,
       r.nombre AS rol
     FROM usuarios u
     INNER JOIN personas p
       ON p.id = u.idPersona
       AND p.idInmobiliaria = u.idInmobiliaria
     INNER JOIN roles r
       ON r.id = u.idRol
     WHERE ${condiciones.join(" AND ")}
     ORDER BY p.apellido, p.nombre, u.id
     LIMIT ${LIMITE_BUSQUEDA}`,
    parametros
  )
  return filas
}

async function registrarLectura(conexion, idInmobiliaria, idConversacion, idPersona) {
  await conexion.execute(
    `INSERT INTO conversacionesEstado (idInmobiliaria, idConversacion, idPersona, fechaUltimaLectura)
     VALUES (?, ?, ?, CURRENT_TIMESTAMP)
     ON DUPLICATE KEY UPDATE fechaUltimaLectura = CURRENT_TIMESTAMP`,
    [idInmobiliaria, idConversacion, idPersona]
  )
}

async function insertarMensaje(conexion, { idInmobiliaria, idConversacion, idPersona, contenido, adjuntos = [] }) {
  const [resultado] = await conexion.execute(
    `INSERT INTO mensajes (idInmobiliaria, idPersona, idConversacion, contenido) VALUES (?, ?, ?, ?)`,
    [idInmobiliaria, idPersona, idConversacion, contenido ?? null]
  )

  for (const adjunto of adjuntos) {
    await conexion.execute(
      `INSERT INTO mensajesAdjuntos (idInmobiliaria, idMensaje, nombreArchivo, rutaArchivo, mimeType, tamanioBytes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [idInmobiliaria, resultado.insertId, adjunto.nombreArchivo, adjunto.rutaArchivo, adjunto.mimeType, adjunto.tamanioBytes]
    )
  }

  await registrarLectura(conexion, idInmobiliaria, idConversacion, idPersona)
  return resultado.insertId
}

async function buscarConversacionEntre(conexion, idInmobiliaria, idPersonaA, idPersonaB) {
  const [filas] = await conexion.execute(
    `SELECT c.id
     FROM conversaciones c
     WHERE c.idInmobiliaria = ?
       AND ((c.idPersona1 = ? AND c.idPersona2 = ?) OR (c.idPersona1 = ? AND c.idPersona2 = ?))
     LIMIT 1
     FOR UPDATE`,
    [idInmobiliaria, idPersonaA, idPersonaB, idPersonaB, idPersonaA]
  )
  return filas[0]?.id ?? null
}

async function iniciar(idUsuario, { idUsuario: idDestinatario, mensaje }, reintento = false) {
  const remitente = await obtenerUsuario(idUsuario)
  const destinatario = await obtenerUsuario(idDestinatario)

  if (!remitente || !destinatario || destinatario.idInmobiliaria !== remitente.idInmobiliaria || !destinatario.fechaActivacion) {
    return { error: "NO_ENCONTRADO", mensaje: "El usuario destinatario no existe" }
  }
  if (destinatario.id === remitente.id) {
    return { error: "DATOS_INVALIDOS", mensaje: "No puede iniciar una conversación consigo mismo" }
  }
  if (!puedenConversar(remitente.idRol, destinatario.idRol)) {
    return { error: "SIN_PERMISO", mensaje: "No puede iniciar una conversación con ese usuario" }
  }

  const idInmobiliaria = remitente.idInmobiliaria
  const conexion = await db.getConnection()
  let idConversacion, idMensaje, creada = false, duplicada = false

  try {
    await conexion.beginTransaction()
    idConversacion = await buscarConversacionEntre(conexion, idInmobiliaria, remitente.idPersona, destinatario.idPersona)

    if (!idConversacion) {
      const [resultado] = await conexion.execute(
        `INSERT INTO conversaciones (idInmobiliaria, idPersona1, idPersona2) VALUES (?, ?, ?)`,
        [idInmobiliaria, Math.min(remitente.idPersona, destinatario.idPersona), Math.max(remitente.idPersona, destinatario.idPersona)]
      )
      idConversacion = resultado.insertId
      creada = true
      await conexion.execute(
        `INSERT INTO conversacionesEstado (idInmobiliaria, idConversacion, idPersona) VALUES (?, ?, ?)`,
        [idInmobiliaria, idConversacion, destinatario.idPersona]
      )
    }

    idMensaje = await insertarMensaje(conexion, { idInmobiliaria, idConversacion, idPersona: remitente.idPersona, contenido: mensaje })
    await conexion.commit()
  } catch (error) {
    await conexion.rollback()
    if (error.code !== "ER_DUP_ENTRY" || reintento) {
      throw error
    }
    duplicada = true
  } finally {
    conexion.release()
  }

  if (duplicada) {
    return iniciar(idUsuario, { idUsuario: idDestinatario, mensaje }, true)
  }

  return {
    creada,
    conversacion: await buscarConversacion(remitente.id, idConversacion),
    mensaje: await obtenerMensaje(idMensaje, idInmobiliaria),
    destinatario: { idUsuario: destinatario.id, idPersona: destinatario.idPersona },
  }
}

async function historial(idUsuario, idConversacion, { page = 1, limit = 10 } = {}) {
  const conversacion = await buscarConversacion(idUsuario, idConversacion)
  if (!conversacion) {
    return null
  }

  const offset = (page - 1) * limit
  const [[filas], [conteo]] = await Promise.all([
    db.execute(
      `${SELECT_MENSAJE}
       WHERE m.idConversacion = ? AND m.idInmobiliaria = ?
       ORDER BY m.fecha DESC, m.id DESC
       LIMIT ? OFFSET ?`,
      [idConversacion, conversacion.idInmobiliaria, limit, offset]
    ),
    db.execute(
      `SELECT COUNT(*) AS total FROM mensajes m WHERE m.idConversacion = ? AND m.idInmobiliaria = ?`,
      [idConversacion, conversacion.idInmobiliaria]
    ),
  ])

  const total = Number(conteo[0].total)
  return {
    items: await agregarAdjuntos(filas),
    paginacion: { pagina: page, limite: limit, total, paginas: Math.ceil(total / limit) },
  }
}

async function enviar(idUsuario, idConversacion, { contenido, adjuntos = [] }) {
  const conversacion = await buscarConversacion(idUsuario, idConversacion)
  if (!conversacion) {
    return { error: "NO_ENCONTRADO", mensaje: "La conversación no existe" }
  }
  if (!conversacion.idPersona) {
    return { error: "CONFLICTO", mensaje: "El otro participante fue eliminado; la conversación es solo de lectura" }
  }

  const remitente = await obtenerUsuario(idUsuario)
  const conexion = await db.getConnection()
  let idMensaje
  try {
    await conexion.beginTransaction()
    idMensaje = await insertarMensaje(conexion, {
      idInmobiliaria: conversacion.idInmobiliaria,
      idConversacion,
      idPersona: remitente.idPersona,
      contenido,
      adjuntos,
    })
    await conexion.commit()
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }

  const destinatario = conversacion.idUsuario
    ? { idUsuario: conversacion.idUsuario, idPersona: conversacion.idPersona }
    : null

  return {
    mensaje: await obtenerMensaje(idMensaje, conversacion.idInmobiliaria),
    destinatario,
  }
}

async function marcarLeida(idUsuario, idConversacion) {
  const conversacion = await buscarConversacion(idUsuario, idConversacion)
  if (!conversacion) {
    return null
  }

  const usuario = await obtenerUsuario(idUsuario)
  await registrarLectura(db, conversacion.idInmobiliaria, idConversacion, usuario.idPersona)

  return buscarConversacion(idUsuario, idConversacion)
}

async function buscar(idUsuario, { q, fecha }) {
  const condiciones = ["u.id = ?"]
  const parametros = [idUsuario]

  if (q) {
    condiciones.push("m.contenido LIKE ?")
    parametros.push(like(q))
  }
  if (fecha) {
    condiciones.push("m.fecha >= ? AND m.fecha < DATE_ADD(?, INTERVAL 1 DAY)")
    parametros.push(fecha, fecha)
  }

  const [mensajes] = await db.execute(
    `SELECT
       m.id,
       m.idConversacion,
       m.idPersona,
       ur.id AS idUsuario,
       COALESCE(p.nombre, 'Usuario') AS nombre,
       COALESCE(p.apellido, 'eliminado') AS apellido,
       m.contenido,
       m.fecha
     FROM usuarios u
     INNER JOIN conversaciones c
       ON c.idInmobiliaria = u.idInmobiliaria
       AND u.idPersona IN (c.idPersona1, c.idPersona2)
     INNER JOIN mensajes m
       ON m.idConversacion = c.id
       AND m.idInmobiliaria = c.idInmobiliaria
     LEFT JOIN personas p
       ON p.id = m.idPersona
       AND p.idInmobiliaria = m.idInmobiliaria
     LEFT JOIN usuarios ur
       ON ur.idPersona = m.idPersona
       AND ur.idInmobiliaria = m.idInmobiliaria
     WHERE ${condiciones.join(" AND ")}
     ORDER BY m.fecha DESC, m.id DESC
     LIMIT ${LIMITE_BUSQUEDA}`,
    parametros
  )

  let conversaciones = []
  if (q) {
    const [filas] = await db.execute(
      `${SELECT_CONVERSACION}
       WHERE u.id = ? AND CONCAT(otro.nombre, ' ', otro.apellido) LIKE ?
       ${ORDEN_CONVERSACIONES}
       LIMIT ${LIMITE_BUSQUEDA}`,
      [idUsuario, like(q)]
    )
    conversaciones = filas.map(normalizarConversacion)
  }

  return { conversaciones, mensajes }
}

async function obtenerAdjunto(idUsuario, idConversacion, idAdjunto) {
  const [filas] = await db.execute(
    `SELECT
       a.nombreArchivo,
       a.rutaArchivo,
       a.mimeType
     FROM mensajesAdjuntos a
     INNER JOIN mensajes m
       ON m.id = a.idMensaje
       AND m.idInmobiliaria = a.idInmobiliaria
     INNER JOIN conversaciones c
       ON c.id = m.idConversacion
       AND c.idInmobiliaria = m.idInmobiliaria
     INNER JOIN usuarios u
       ON u.idInmobiliaria = c.idInmobiliaria
       AND u.idPersona IN (c.idPersona1, c.idPersona2)
     WHERE a.id = ?
       AND c.id = ?
       AND u.id = ?
     LIMIT 1`,
    [idAdjunto, idConversacion, idUsuario]
  )
  return filas[0] || null
}

async function ultimaConversacion(idUsuario) {
  const [filas] = await db.execute(
    `${SELECT_CONVERSACION}
     WHERE u.id = ? AND um.id IS NOT NULL
     ORDER BY um.fecha DESC, um.id DESC
     LIMIT 1`,
    [idUsuario]
  )
  return filas[0] ? normalizarConversacion(filas[0]) : null
}

module.exports = {
  ultimaConversacion,
  listar,
  esParticipante,
  contactos,
  iniciar,
  historial,
  enviar,
  marcarLeida,
  buscar,
  obtenerAdjunto,
}
