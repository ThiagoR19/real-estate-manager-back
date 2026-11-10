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

async function resumenDeContrato(idInmobiliaria, idContrato, venceAntesDe) {
  const [filas] = await db.execute(
    `SELECT
       COUNT(*) AS habilitados,
       COALESCE(SUM(EXISTS (
         SELECT 1
         FROM comprobantes c
         WHERE c.idPago = p.id
           AND c.idInmobiliaria = p.idInmobiliaria
       )), 0) AS comprobantesEnviados,
       COALESCE(SUM(ep.nombre = 'Aprobado'), 0) AS aprobados,
       COALESCE(SUM(ep.nombre = 'Rechazado'), 0) AS rechazados
     FROM pagos p
     INNER JOIN estadosPagos ep
       ON ep.id = p.idEstado
     WHERE p.idInmobiliaria = ?
       AND p.idContrato = ?
       AND p.fechaVencimiento < ?`,
    [idInmobiliaria, idContrato, venceAntesDe]
  )
  const fila = filas[0]
  return {
    habilitados: Number(fila.habilitados),
    comprobantesEnviados: Number(fila.comprobantesEnviados),
    aprobados: Number(fila.aprobados),
    rechazados: Number(fila.rechazados),
  }
}

module.exports = { contarAprobados, resumenDeContrato }
