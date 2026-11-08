const contratos = require("../contratos/contratos.service")
const pagos = require("../pagos/pagos.service")
const reportes = require("../reportes/reportes.service")
const inquilinos = require("../inquilinos/inquilinos.service")
const visitas = require("../visitas/visitas.service")
const agentes = require("../agentes/agentes.service")
const propiedades = require("../propiedades/propiedades.service")
const { dosDigitos, fechaLocal, sumarDias, diaDeLaSemana, ultimoDiaDelMes, mesDe } = require("../../utils/fechas")

const LIMITE_REPORTES = 5
const LIMITE_TOP_AGENTES = 5

function diasDelRendimiento(hoy) {
  const lunes = sumarDias(hoy, -diaDeLaSemana(hoy))
  const semana = Array.from({ length: 7 }, (_, indice) => sumarDias(lunes, indice))

  const { anio, mes } = mesDe(hoy)
  const mesActual = Array.from({ length: ultimoDiaDelMes(anio, mes) }, (_, indice) => `${anio}-${dosDigitos(mes)}-${dosDigitos(indice + 1)}`)

  const anioActual = Array.from({ length: 12 }, (_, indice) => {
    const numero = indice + 1
    const inicio = `${anio}-${dosDigitos(numero)}-01`
    const cierre = `${anio}-${dosDigitos(numero)}-${dosDigitos(ultimoDiaDelMes(anio, numero))}`
    return { mes: numero, dia: inicio > hoy ? null : (cierre < hoy ? cierre : hoy) }
  })

  return { semana, mes: mesActual, anio: anioActual }
}

const punto = (vigentes) => ({ visitasLanding: null, visitasPropiedades: null, contratosVigentes: vigentes })

async function rendimiento(idInmobiliaria, hoy) {
  const dias = diasDelRendimiento(hoy)
  const consultar = [...new Set([
    ...dias.semana,
    ...dias.mes,
    ...dias.anio.map((punto) => punto.dia).filter(Boolean),
  ].filter((dia) => dia <= hoy))]

  const cantidades = await contratos.contarAlquileresVigentes(idInmobiliaria, consultar)
  const vigentes = new Map(consultar.map((dia, indice) => [dia, cantidades[indice]]))
  const valor = (dia) => (dia && dia <= hoy ? vigentes.get(dia) : null)

  return {
    semana: dias.semana.map((fecha) => ({ fecha, ...punto(valor(fecha)) })),
    mes: dias.mes.map((fecha) => ({ fecha, ...punto(valor(fecha)) })),
    anio: dias.anio.map(({ mes, dia }) => ({ mes, ...punto(valor(dia)) })),
  }
}

async function indicadores(idInmobiliaria, hoy) {
  const { inicio, siguiente, anterior } = mesDe(hoy)

  const [inquilinosActivos, reportesVigentes, pagosMes, pagosMesAnterior, firmadosMes, firmadosMesAnterior] = await Promise.all([
    inquilinos.contarActivos(idInmobiliaria),
    reportes.contarSinResolver(idInmobiliaria),
    pagos.contarAprobados(idInmobiliaria, inicio, siguiente),
    pagos.contarAprobados(idInmobiliaria, anterior, inicio),
    contratos.contarFirmados(idInmobiliaria, inicio, siguiente),
    contratos.contarFirmados(idInmobiliaria, anterior, inicio),
  ])

  return {
    inquilinosActivos: { actual: inquilinosActivos, anterior: null },
    reportesVigentes: { actual: reportesVigentes, anterior: null },
    pagosAprobados: { actual: pagosMes, anterior: pagosMesAnterior },
    contratosFirmados: { actual: firmadosMes, anterior: firmadosMesAnterior },
  }
}

async function agendaDelAgente(usuario, hoy) {
  const idAgente = await visitas.agenteDelUsuario(usuario.id, usuario.idInmobi)
  return idAgente ? visitas.agendaDelDia(usuario.idInmobi, idAgente, hoy) : []
}

async function topAgentes(idInmobiliaria) {
  const ranking = await contratos.contarPorAgente(idInmobiliaria, LIMITE_TOP_AGENTES)
  const nombres = await agentes.buscarNombres(idInmobiliaria, ranking.map((fila) => fila.idAgente))
  const porId = new Map(nombres.map((agente) => [agente.id, agente]))

  return ranking.map((fila) => ({
    idAgente: fila.idAgente,
    nombre: porId.get(fila.idAgente)?.nombre ?? null,
    apellido: porId.get(fila.idAgente)?.apellido ?? null,
    ventas: fila.ventas,
    alquileres: fila.alquileres,
  }))
}

async function estadosDePropiedades(idInmobiliaria) {
  const estados = await propiedades.contarPorEstado(idInmobiliaria)
  return {
    total: estados.total,
    enAlquiler: estados.alquiladas,
    vendidas: estados.vendidas,
    vacias: estados.disponibles,
  }
}

async function resumenAdministrador(usuario) {
  const hoy = fechaLocal()
  const idInmobiliaria = usuario.idInmobi

  const [graficos, totales, ranking, estados] = await Promise.all([
    rendimiento(idInmobiliaria, hoy),
    indicadores(idInmobiliaria, hoy),
    topAgentes(idInmobiliaria),
    estadosDePropiedades(idInmobiliaria),
  ])

  return {
    fecha: hoy,
    rendimiento: graficos,
    indicadores: totales,
    topAgentes: ranking,
    estadosPropiedades: estados,
  }
}

async function resumenAgente(usuario) {
  const hoy = fechaLocal()
  const idInmobiliaria = usuario.idInmobi

  const [graficos, totales, agenda, reportesSinRevisar] = await Promise.all([
    rendimiento(idInmobiliaria, hoy),
    indicadores(idInmobiliaria, hoy),
    agendaDelAgente(usuario, hoy),
    reportes.listarSinRevisar(idInmobiliaria, LIMITE_REPORTES),
  ])

  return {
    fecha: hoy,
    rendimiento: graficos,
    indicadores: totales,
    agenda,
    reportesSinRevisar,
  }
}

async function resumenPropietario(usuario) {
  return {}
}

async function resumenInquilino(usuario) {
  return {}
}

module.exports = { resumenAdministrador, resumenAgente, resumenPropietario, resumenInquilino }
