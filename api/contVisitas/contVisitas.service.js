const db = require("../../db/conexion")
const { fechaLocal } = require("../../utils/fechas")

async function sumar(idInmobiliaria) {
  try {
    await db.execute(
      `INSERT INTO contVisitas (idInmobiliaria, fecha, cantidad)
       VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE cantidad = cantidad + 1`,
      [idInmobiliaria, fechaLocal()]
    )
  } catch (error) {
    if (error.code === "ER_NO_REFERENCED_ROW_2") {
      return { error: "NO_ENCONTRADO", mensaje: "La inmobiliaria no existe" }
    }
    throw error
  }
  return {}
}

async function listar(idInmobiliaria, { desde, hasta } = {}) {
  const condiciones = ["cv.idInmobiliaria = ?"]
  const parametros = [idInmobiliaria]

  if (desde) {
    condiciones.push("cv.fecha >= ?")
    parametros.push(desde)
  }
  if (hasta) {
    condiciones.push("cv.fecha <= ?")
    parametros.push(hasta)
  }

  const [filas] = await db.execute(
    `SELECT
       DATE_FORMAT(cv.fecha, '%Y-%m-%d') AS fecha,
       cv.cantidad
     FROM contVisitas cv
     WHERE ${condiciones.join(" AND ")}
     ORDER BY cv.fecha`,
    parametros
  )

  const dias = filas.map((fila) => ({ fecha: fila.fecha, cantidad: Number(fila.cantidad) }))
  return {
    desde: desde ?? null,
    hasta: hasta ?? null,
    total: dias.reduce((suma, dia) => suma + dia.cantidad, 0),
    dias,
  }
}

async function contarPorDia(idInmobiliaria, desde, hasta) {
  const { dias } = await listar(idInmobiliaria, { desde, hasta })
  return new Map(dias.map((dia) => [dia.fecha, dia.cantidad]))
}

module.exports = { sumar, listar, contarPorDia }
