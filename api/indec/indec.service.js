const db = require("../../db/conexion")

const ZONA_HORARIA = "America/Argentina/Buenos_Aires"

const SELECT_INDEC = `
  SELECT
    i.id,
    i.anio,
    i.mes,
    i.valor AS porcentaje,
    i.fechaRegistro
  FROM indec i
`

const normalizar = (fila) => ({ ...fila, porcentaje: Number(fila.porcentaje) })

function mesActual() {
  const partes = new Intl.DateTimeFormat("en-US", { timeZone: ZONA_HORARIA, year: "numeric", month: "numeric" }).formatToParts(new Date())
  return {
    anio: Number(partes.find((parte) => parte.type === "year").value),
    mes: Number(partes.find((parte) => parte.type === "month").value),
  }
}

async function listar(idInmobiliaria, anio = mesActual().anio) {
  const [filas] = await db.execute(
    `${SELECT_INDEC} WHERE i.idInmobiliaria = ? AND i.anio = ? ORDER BY i.mes`,
    [idInmobiliaria, anio]
  )
  return { anio, items: filas.map(normalizar) }
}

async function buscarPorId(idInmobiliaria, id) {
  const [filas] = await db.execute(`${SELECT_INDEC} WHERE i.idInmobiliaria = ? AND i.id = ?`, [idInmobiliaria, id])
  return filas[0] ? normalizar(filas[0]) : null
}

async function crear(idInmobiliaria, { anio, mes, porcentaje }) {
  const actual = mesActual()
  if (anio > actual.anio || (anio === actual.anio && mes > actual.mes)) {
    return { error: "DATOS_INVALIDOS", mensaje: "No se puede cargar el porcentaje de un mes que todavía no empezó" }
  }

  try {
    const [resultado] = await db.execute(
      `INSERT INTO indec (idInmobiliaria, anio, mes, valor) VALUES (?, ?, ?, ?)`,
      [idInmobiliaria, anio, mes, porcentaje]
    )
    return { indec: await buscarPorId(idInmobiliaria, resultado.insertId) }
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return { error: "CONFLICTO", mensaje: "Ese mes ya tiene un porcentaje cargado" }
    }
    throw error
  }
}

module.exports = { listar, crear }
