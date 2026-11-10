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

async function inquilinosVigentes(idInmobiliaria, idsPropiedades, dia) {
  if (!idsPropiedades.length) {
    return []
  }
  const [filas] = await db.execute(
    `SELECT
       c.idPropiedad,
       c.id AS idContrato,
       per.id AS idPersona,
       per.nombre,
       per.apellido,
       c.fechaAnulacion
     FROM contratos c
     INNER JOIN tiposContratos tc
       ON tc.id = c.idTipoContrato
     INNER JOIN estadosContratos ec
       ON ec.id = c.idEstadoContrato
     INNER JOIN contratosPersonas cp
       ON cp.idContrato = c.id
       AND cp.idInmobiliaria = c.idInmobiliaria
     INNER JOIN tiposParticipacion tp
       ON tp.id = cp.idTipoParticipacion
     INNER JOIN personas per
       ON per.id = cp.idPersona
       AND per.idInmobiliaria = cp.idInmobiliaria
     WHERE c.idInmobiliaria = ?
       AND c.idPropiedad IN (${marcadores(idsPropiedades)})
       AND tc.nombre = 'Alquiler'
       AND tp.nombre = 'Inquilino'
       AND ec.nombre NOT IN (${marcadores(ESTADOS_SIN_VIGENCIA)})
       AND c.fechaInicio <= ?
       AND (c.fechaFin IS NULL OR c.fechaFin >= ?)
     ORDER BY c.idPropiedad, c.id, per.id`,
    [idInmobiliaria, ...idsPropiedades, ...ESTADOS_SIN_VIGENCIA, dia, dia]
  )
  return filas
    .filter((fila) => !fila.fechaAnulacion || fechaLocal(fila.fechaAnulacion) > dia)
    .map(({ fechaAnulacion, ...fila }) => fila)
}

module.exports = { contarAlquileresVigentes, contarFirmados, contarPorAgente, inquilinosVigentes }
