const db = require("../../db/conexion")
const { z } = require("zod")

const usuarioSchema = z.object({
  id: z.coerce.number().int().positive(),
})
const idSchema = z.coerce.number().int().positive()

const CAMPOS_NOTIFICACION = `
    n.id,
    n.idInmobiliaria,
    n.idTipo,
    tn.nombre AS tipo,
    n.titulo,
    n.contenido,
    n.fechaCreacion,
    pn.leida,
    pn.fechaLectura
`

const SELECT_NOTIFICACIONES = `
  SELECT ${CAMPOS_NOTIFICACION}
  FROM personasNotificaciones pn
  INNER JOIN notificaciones n
    ON n.id = pn.idNotificacion
    AND n.idInmobiliaria = pn.idInmobiliaria
  INNER JOIN tiposNotificaciones tn
    ON tn.id = n.idTipo
  INNER JOIN usuarios u
    ON u.idPersona = pn.idPersona
    AND u.idInmobiliaria = pn.idInmobiliaria
  WHERE u.id = ?
    AND u.idInmobiliaria = ?
`

const JOIN_PERSONAS = `INNER JOIN usuarios u
  ON u.idPersona = pn.idPersona AND u.idInmobiliaria = pn.idInmobiliaria`
const ORDER_NOTIFICACIONES = "ORDER BY n.fechaCreacion DESC, n.id DESC"
const marcadores = (lista) => lista.map(() => "?").join(", ")

async function guardar(conexion, {
  idInmobiliaria, tipo, titulo, contenido, roles = [], idsPersonas = [], idAgente,
  excluirUsuario = null,
}) {
  const condiciones = []
  const parametros = []
  if (roles.length) {
    condiciones.push(`(u.idRol IN (${marcadores(roles)}) AND u.fechaActivacion IS NOT NULL)`)
    parametros.push(...roles)
  }
  if (idsPersonas.length) {
    condiciones.push(`u.idPersona IN (${marcadores(idsPersonas)})`)
    parametros.push(...idsPersonas)
  }
  if (idAgente) {
    condiciones.push(`EXISTS (
      SELECT 1 FROM agentes a
      WHERE a.id = ? AND a.idInmobiliaria = u.idInmobiliaria AND a.idPersona = u.idPersona
    )`)
    parametros.push(idAgente)
  }
  if (!condiciones.length) return null

  const [destinatarios] = await conexion.execute(
    `SELECT u.id, u.idPersona FROM usuarios u
     WHERE u.idInmobiliaria = ? AND u.id <> ? AND (${condiciones.join(" OR ")})`,
    [idInmobiliaria, excluirUsuario ?? 0, ...parametros]
  )
  if (!destinatarios.length) return null

  const [tipos] = await conexion.execute("SELECT id FROM tiposNotificaciones WHERE nombre = ?", [tipo])
  if (!tipos.length) throw new Error(`Falta el tipo de notificación ${tipo}`)

  const idTipo = tipos[0].id
  const fechaCreacion = new Date()
  const [{ insertId: id }] = await conexion.execute(
    `INSERT INTO notificaciones (idInmobiliaria, idTipo, titulo, contenido, fechaCreacion)
     VALUES (?, ?, ?, ?, ?)`,
    [idInmobiliaria, idTipo, titulo, contenido, fechaCreacion]
  )

  await conexion.execute(
    `INSERT INTO personasNotificaciones (idInmobiliaria, idNotificacion, idPersona)
     VALUES ${destinatarios.map(() => "(?, ?, ?)").join(", ")}`,
    destinatarios.flatMap((usuario) => [idInmobiliaria, id, usuario.idPersona])
  )
  return {
    idsUsuarios: destinatarios.map((usuario) => usuario.id),
    notificacion: { id, idInmobiliaria, idTipo, tipo, titulo, contenido, fechaCreacion, leida: false, fechaLectura: null },
  }
}

async function listar(usuario, idInmobiliaria) {
  const { id: idUsuario } = usuarioSchema.parse(usuario)
  const [filas] = await db.execute(
    `${SELECT_NOTIFICACIONES} ${ORDER_NOTIFICACIONES}`,
    [idUsuario, idSchema.parse(idInmobiliaria)]
  )

  return filas
}

async function actualizar(usuario, id, idInmobiliaria) {
  const { id: idUsuario } = usuarioSchema.parse(usuario)
  const idNotificacion = idSchema.parse(id)
  const vinculo = `personasNotificaciones pn ${JOIN_PERSONAS}`
  const alcance = "u.id = ? AND u.idInmobiliaria = ?"
  const parametros = [idNotificacion, idUsuario, idSchema.parse(idInmobiliaria)]
  const [resultado] = await db.execute(
    `UPDATE ${vinculo}
     SET pn.leida = TRUE,
         pn.fechaLectura = COALESCE(pn.fechaLectura, CURRENT_TIMESTAMP)
     WHERE pn.idNotificacion = ? AND ${alcance}`,
    parametros
  )

  if (resultado.affectedRows > 0) return true

  const [filas] = await db.execute(
    `SELECT 1 FROM ${vinculo} WHERE pn.idNotificacion = ? AND ${alcance} LIMIT 1`,
    parametros
  )
  return filas.length > 0
}

async function listarNoLeidas(idUsuario, idInmobiliaria, limite = 5) {
  const [[filas], [conteo]] = await Promise.all([
    db.execute(
      `${SELECT_NOTIFICACIONES}
         AND pn.leida = FALSE
       ORDER BY n.fechaCreacion DESC, n.id DESC
       LIMIT ?`,
      [idUsuario, idInmobiliaria, limite]
    ),
    db.execute(
      `SELECT COUNT(*) AS total
       FROM personasNotificaciones pn
       INNER JOIN usuarios u
         ON u.idPersona = pn.idPersona
         AND u.idInmobiliaria = pn.idInmobiliaria
       WHERE u.id = ?
         AND u.idInmobiliaria = ?
         AND pn.leida = FALSE`,
      [idUsuario, idInmobiliaria]
    ),
  ])
  return { total: Number(conteo[0].total), items: filas }
}

module.exports = { guardar, listar, actualizar, listarNoLeidas }
