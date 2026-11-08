const db = require("../../db/conexion")
const { fechaLocal } = require("../../utils/fechas")

const ESTADOS_SIN_VIGENCIA = ["Borrador", "Anulado"]

const marcadores = (lista) => lista.map(() => "?").join(", ")

async function contarAlquileresVigentes(idInmobiliaria, dias) {
  if (!dias.length) {
    return []
  }

  const [filas] = await db.execute(
    `SELECT
       c.fechaInicio,
       c.fechaFin,
       c.fechaAnulacion
     FROM contratos c
     INNER JOIN tiposContratos tc
       ON tc.id = c.idTipoContrato
     INNER JOIN estadosContratos ec
       ON ec.id = c.idEstadoContrato
     WHERE c.idInmobiliaria = ?
       AND tc.nombre = 'Alquiler'
       AND ec.nombre NOT IN (${marcadores(ESTADOS_SIN_VIGENCIA)})
       AND c.fechaInicio IS NOT NULL`,
    [idInmobiliaria, ...ESTADOS_SIN_VIGENCIA]
  )

  const contratos = filas.map((fila) => ({
    inicio: fila.fechaInicio.toISOString().slice(0, 10),
    fin: fila.fechaFin ? fila.fechaFin.toISOString().slice(0, 10) : null,
    anulacion: fila.fechaAnulacion ? fechaLocal(fila.fechaAnulacion) : null,
  }))

  return dias.map((dia) => contratos.filter((contrato) =>
    contrato.inicio <= dia &&
    (contrato.fin === null || contrato.fin >= dia) &&
    (contrato.anulacion === null || contrato.anulacion > dia)
  ).length)
}

async function contarFirmados(idInmobiliaria, desde, hasta) {
  const [filas] = await db.execute(
    `SELECT COUNT(*) AS total
     FROM contratos c
     INNER JOIN estadosContratos ec
       ON ec.id = c.idEstadoContrato
     WHERE c.idInmobiliaria = ?
       AND ec.nombre NOT IN (${marcadores(ESTADOS_SIN_VIGENCIA)})
       AND c.fechaFirma >= ?
       AND c.fechaFirma < ?`,
    [idInmobiliaria, ...ESTADOS_SIN_VIGENCIA, desde, hasta]
  )
  return Number(filas[0].total)
}

async function contarPorAgente(idInmobiliaria, limite = 5) {
  const [filas] = await db.execute(
    `SELECT
       p.idAgente,
       SUM(tc.nombre = 'Venta') AS ventas,
       SUM(tc.nombre = 'Alquiler') AS alquileres
     FROM contratos c
     INNER JOIN tiposContratos tc
       ON tc.id = c.idTipoContrato
     INNER JOIN estadosContratos ec
       ON ec.id = c.idEstadoContrato
     INNER JOIN propiedades p
       ON p.id = c.idPropiedad
       AND p.idInmobiliaria = c.idInmobiliaria
     WHERE c.idInmobiliaria = ?
       AND ec.nombre NOT IN (${marcadores(ESTADOS_SIN_VIGENCIA)})
       AND p.idAgente IS NOT NULL
     GROUP BY p.idAgente
     ORDER BY (ventas + alquileres) DESC, ventas DESC, p.idAgente
     LIMIT ?`,
    [idInmobiliaria, ...ESTADOS_SIN_VIGENCIA, limite]
  )
  return filas.map((fila) => ({ idAgente: fila.idAgente, ventas: Number(fila.ventas), alquileres: Number(fila.alquileres) }))
}

module.exports = { contarAlquileresVigentes, contarFirmados, contarPorAgente }
