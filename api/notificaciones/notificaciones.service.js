const db = require("../../db/conexion")
const { z } = require("zod")

const usuarioSchema = z.object({
  id: z.coerce.number().int().positive(),
})
const idSchema = z.coerce.number().int().positive()

const SELECT_NOTIFICACIONES = `
  SELECT
    n.id,
    n.idInmobiliaria,
    n.idTipo,
    tn.nombre AS tipo,
    n.titulo,
    n.contenido,
    n.fechaCreacion,
    pn.leida,
    pn.fechaLectura
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

async function listar(usuario, idInmobiliaria) {
  const { id: idUsuario } = usuarioSchema.parse(usuario)
  const inmobiliaria = idSchema.parse(idInmobiliaria)
  const [filas] = await db.execute(
    `${SELECT_NOTIFICACIONES}
     ORDER BY n.fechaCreacion DESC, n.id DESC`,
    [idUsuario, inmobiliaria]
  )

  return filas
}

async function actualizar(usuario, id, idInmobiliaria) {
  const { id: idUsuario } = usuarioSchema.parse(usuario)
  const idNotificacion = idSchema.parse(id)
  const inmobiliaria = idSchema.parse(idInmobiliaria)
  const [resultado] = await db.execute(
    `UPDATE personasNotificaciones pn
     INNER JOIN usuarios u
       ON u.idPersona = pn.idPersona
       AND u.idInmobiliaria = pn.idInmobiliaria
     SET pn.leida = TRUE,
         pn.fechaLectura = CURRENT_TIMESTAMP
     WHERE pn.idNotificacion = ?
       AND u.id = ?
       AND u.idInmobiliaria = ?`,
    [idNotificacion, idUsuario, inmobiliaria]
  )

  return resultado.affectedRows > 0
}

module.exports = { listar, actualizar }
