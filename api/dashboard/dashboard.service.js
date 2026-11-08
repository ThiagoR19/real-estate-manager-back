const db = require("../../db/conexion")

const ZONA_HORARIA = "America/Argentina/Buenos_Aires"
const ESTADOS_SIN_VIGENCIA = ["Borrador", "Anulado"]
const UN_DIA = 24 * 60 * 60 * 1000

const marcadores = (lista) => lista.map(() => "?").join(", ")

function fechaLocal(fecha = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONA_HORARIA, year: "numeric", month: "2-digit", day: "2-digit" }).format(fecha)
}

const sumarDias = (texto, dias) => new Date(Date.parse(`${texto}T00:00:00Z`) + dias * UN_DIA).toISOString().slice(0, 10)
const diaDeLaSemana = (texto) => (new Date(`${texto}T00:00:00Z`).getUTCDay() + 6) % 7
const ultimoDiaDelMes = (anio, mes) => new Date(Date.UTC(anio, mes, 0)).getUTCDate()
const dosDigitos = (numero) => String(numero).padStart(2, "0")

function periodosDelMes(hoy) {
  const [anio, mes] = hoy.split("-").map(Number)
  const inicio = `${anio}-${dosDigitos(mes)}-01`
  const siguiente = mes === 12 ? `${anio + 1}-01-01` : `${anio}-${dosDigitos(mes + 1)}-01`
  const anterior = mes === 1 ? `${anio - 1}-12-01` : `${anio}-${dosDigitos(mes - 1)}-01`
  return { anio, mes, inicio, siguiente, anterior }
}

async function contratosDeAlquiler(idInmobiliaria) {
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

  return filas.map((fila) => ({
    inicio: fila.fechaInicio.toISOString().slice(0, 10),
    fin: fila.fechaFin ? fila.fechaFin.toISOString().slice(0, 10) : null,
    anulacion: fila.fechaAnulacion ? fechaLocal(fila.fechaAnulacion) : null,
  }))
}

function vigentesEl(contratos, dia) {
  return contratos.filter((contrato) =>
    contrato.inicio <= dia &&
    (contrato.fin === null || contrato.fin >= dia) &&
    (contrato.anulacion === null || contrato.anulacion > dia)
  ).length
}

function punto(contratos, dia, hoy) {
  return {
    visitasLanding: null,
    visitasPropiedades: null,
    contratosVigentes: dia <= hoy ? vigentesEl(contratos, dia) : null,
  }
}

function rendimiento(contratos, hoy) {
  const lunes = sumarDias(hoy, -diaDeLaSemana(hoy))
  const semana = Array.from({ length: 7 }, (_, indice) => {
    const fecha = sumarDias(lunes, indice)
    return { fecha, ...punto(contratos, fecha, hoy) }
  })

  const { anio, mes } = periodosDelMes(hoy)
  const mesActual = Array.from({ length: ultimoDiaDelMes(anio, mes) }, (_, indice) => {
    const fecha = `${anio}-${dosDigitos(mes)}-${dosDigitos(indice + 1)}`
    return { fecha, ...punto(contratos, fecha, hoy) }
  })

  const anioActual = Array.from({ length: 12 }, (_, indice) => {
    const numero = indice + 1
    const cierre = `${anio}-${dosDigitos(numero)}-${dosDigitos(ultimoDiaDelMes(anio, numero))}`
    const inicio = `${anio}-${dosDigitos(numero)}-01`
    if (inicio > hoy) {
      return { mes: numero, visitasLanding: null, visitasPropiedades: null, contratosVigentes: null }
    }
    return { mes: numero, ...punto(contratos, cierre < hoy ? cierre : hoy, hoy) }
  })

  return { semana, mes: mesActual, anio: anioActual }
}

async function contar(sql, parametros) {
  const [filas] = await db.execute(sql, parametros)
  return Number(filas[0].total)
}

function pagosAprobados(idInmobiliaria, desde, hasta) {
  return contar(
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
}

function contratosFirmados(idInmobiliaria, desde, hasta) {
  return contar(
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
}

async function indicadores(idInmobiliaria, hoy) {
  const { inicio, siguiente, anterior } = periodosDelMes(hoy)

  const [inquilinosActivos, reportesVigentes, pagosMes, pagosMesAnterior, contratosMes, contratosMesAnterior] = await Promise.all([
    contar(
      `SELECT COUNT(*) AS total
       FROM inquilinos i
       WHERE i.idInmobiliaria = ?
         AND i.activo = TRUE`,
      [idInmobiliaria]
    ),
    contar(
      `SELECT COUNT(*) AS total
       FROM reportes r
       INNER JOIN estadosReportes er
         ON er.id = r.idEstado
       WHERE r.idInmobiliaria = ?
         AND er.nombre <> 'Resuelto'`,
      [idInmobiliaria]
    ),
    pagosAprobados(idInmobiliaria, inicio, siguiente),
    pagosAprobados(idInmobiliaria, anterior, inicio),
    contratosFirmados(idInmobiliaria, inicio, siguiente),
    contratosFirmados(idInmobiliaria, anterior, inicio),
  ])

  return {
    inquilinosActivos: { actual: inquilinosActivos, anterior: null },
    reportesVigentes: { actual: reportesVigentes, anterior: null },
    pagosAprobados: { actual: pagosMes, anterior: pagosMesAnterior },
    contratosFirmados: { actual: contratosMes, anterior: contratosMesAnterior },
  }
}

async function resumenAdministrador(usuario) {
  return {}
}

async function resumenAgente(usuario) {
  const hoy = fechaLocal()
  const [contratos, totales] = await Promise.all([
    contratosDeAlquiler(usuario.idInmobi),
    indicadores(usuario.idInmobi, hoy),
  ])

  return {
    fecha: hoy,
    rendimiento: rendimiento(contratos, hoy),
    indicadores: totales,
  }
}

async function resumenPropietario(usuario) {
  return {}
}

async function resumenInquilino(usuario) {
  return {}
}

module.exports = { resumenAdministrador, resumenAgente, resumenPropietario, resumenInquilino }
