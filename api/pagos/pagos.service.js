const db = require("../../db/conexion")

async function contarAprobados(idInmobiliaria, desde, hasta) {
  const [filas] = await db.execute(
    `SELECT COUNT(*) AS total
     FROM pagos p
     INNER JOIN estadosPagos ep
       ON ep.id = p.idEstado
     WHERE p.idInmobiliaria = ?
       AND ep.nombre = 'Aprobado'
       AND p.fechaPago >= ?
       AND p.fechaPago < ?`,
    [idInmobiliaria, desde, hasta]
  )
  return Number(filas[0].total)
}

module.exports = { contarAprobados }
