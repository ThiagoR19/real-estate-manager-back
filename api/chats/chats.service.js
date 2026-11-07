const db = require("../../db/conexion")

const SELECT_CONVERSACION = `
  SELECT
    c.id,
    c.idInmobiliaria,
    c.fechaCreacion,
    otro.id AS idPersona,
    otro.nombre,
    otro.apellido,
    um.contenido AS ultimoMensaje,
    um.fecha AS fechaUltimoMensaje,
    ce.fechaUltimaLectura,
    (
      SELECT COUNT(*)
      FROM mensajes m
      WHERE m.idConversacion = c.id
        AND m.idInmobiliaria = c.idInmobiliaria
        AND m.idPersona <> u.idPersona
        AND (ce.fechaUltimaLectura IS NULL OR m.fecha > ce.fechaUltimaLectura)
    ) AS noLeidos
  FROM usuarios u
  INNER JOIN conversaciones c
    ON c.idInmobiliaria = u.idInmobiliaria
    AND u.idPersona IN (c.idPersona1, c.idPersona2)
  INNER JOIN personas otro
    ON otro.idInmobiliaria = c.idInmobiliaria
    AND otro.id = IF(c.idPersona1 = u.idPersona, c.idPersona2, c.idPersona1)
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

async function listar(idUsuario) {
  const [filas] = await db.execute(`${SELECT_CONVERSACION} WHERE u.id = ? ORDER BY COALESCE(um.fecha, c.fechaCreacion) DESC, c.id DESC`, [idUsuario])
  return filas.map((fila) => ({ ...fila, noLeidos: Number(fila.noLeidos) }))
}

module.exports = { listar }
