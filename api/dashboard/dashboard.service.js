const contratos = require("../contratos/contratos.service")
const pagos = require("../pagos/pagos.service")
const reportes = require("../reportes/reportes.service")
const inquilinos = require("../inquilinos/inquilinos.service")
const visitas = require("../visitas/visitas.service")
const contVisitas = require("../contVisitas/contVisitas.service")
const agentes = require("../agentes/agentes.service")
const propiedades = require("../propiedades/propiedades.service")
const propietarios = require("../propietarios/propietarios.service")
const chats = require("../chats/chats.service")
const notificaciones = require("../notificaciones/notificaciones.service")
const { dosDigitos, fechaLocal, sumarDias, diaDeLaSemana, ultimoDiaDelMes, mesDe, rangoDelDia } = require("../../utils/fechas")

const LIMITE_REPORTES = 5
const LIMITE_TOP_AGENTES = 5
const LIMITE_MENSAJES = 10

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

const sumarDelMes = (porDia, prefijo) => [...porDia].reduce((suma, [dia, cantidad]) => (dia.startsWith(prefijo) ? suma + cantidad : suma), 0)

async function rendimiento(idInmobiliaria, hoy) {
  const dias = diasDelRendimiento(hoy)
  const { anio } = mesDe(hoy)
  const consultar = [...new Set([
    ...dias.semana,
    ...dias.mes,
    ...dias.anio.map((punto) => punto.dia).filter(Boolean),
  ].filter((dia) => dia <= hoy))]

  const inicioAnio = `${anio}-01-01`
  const finAnio = `${anio}-12-31`
  const desde = dias.semana[0] < inicioAnio ? dias.semana[0] : inicioAnio
  const hasta = dias.semana[6] > finAnio ? dias.semana[6] : finAnio

  const [cantidades, landing, agendadas] = await Promise.all([
    contratos.contarAlquileresVigentes(idInmobiliaria, consultar),
    contVisitas.contarPorDia(idInmobiliaria, desde, hoy),
    visitas.contarAgendadasPorDia(idInmobiliaria, desde, hasta),
  ])
  const vigentes = new Map(consultar.map((dia, indice) => [dia, cantidades[indice]]))

  const delDia = (fecha) => ({
    visitasLanding: landing.get(fecha) ?? 0,
    visitasPropiedades: agendadas.get(fecha) ?? 0,
    contratosVigentes: fecha <= hoy ? vigentes.get(fecha) : null,
  })

  const delMes = ({ mes, dia }) => {
    const prefijo = `${anio}-${dosDigitos(mes)}-`
    return {
      visitasLanding: sumarDelMes(landing, prefijo),
      visitasPropiedades: sumarDelMes(agendadas, prefijo),
      contratosVigentes: dia ? vigentes.get(dia) : null,
    }
  }

  return {
    semana: dias.semana.map((fecha) => ({ fecha, ...delDia(fecha) })),
    mes: dias.mes.map((fecha) => ({ fecha, ...delDia(fecha) })),
    anio: dias.anio.map((punto) => ({ mes: punto.mes, ...delMes(punto) })),
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
    fotoPerfil: porId.get(fila.idAgente)?.fotoPerfil ?? null,
    urlFotoPerfil: porId.get(fila.idAgente)?.urlFotoPerfil ?? null,
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

function resumenDePropiedades(lista, inquilinos) {
  const inquilinosPorPropiedad = new Map()
  for (const inquilino of inquilinos) {
    const nombres = inquilinosPorPropiedad.get(inquilino.idPropiedad) || []
    nombres.push({ idPersona: inquilino.idPersona, nombre: inquilino.nombre, apellido: inquilino.apellido })
    inquilinosPorPropiedad.set(inquilino.idPropiedad, nombres)
  }

  const contar = (estado) => lista.filter((propiedad) => propiedad.estadoComercial === estado).length
  return {
    total: lista.length,
    vendidas: contar("Vendida"),
    enAlquiler: contar("Alquilada"),
    disponibles: contar("Disponible Venta") + contar("Disponible Alquiler"),
    propiedades: lista.map(({ idAgente, ...propiedad }) => ({
      ...propiedad,
      inquilinos: inquilinosPorPropiedad.get(propiedad.id) || [],
    })),
  }
}

async function chatMasReciente(usuario) {
  const conversacion = await chats.ultimaConversacion(usuario.id)
  if (!conversacion) {
    return null
  }

  const mensajes = await chats.historial(usuario.id, conversacion.id, { page: 1, limit: LIMITE_MENSAJES })
  return { conversacion, mensajes: mensajes ? mensajes.items : [] }
}

async function resumenPropietario(usuario) {
  const hoy = fechaLocal()
  const idInmobiliaria = usuario.idInmobi
  const idPersona = await propietarios.personaDelUsuario(usuario.id, idInmobiliaria)
  const lista = idPersona ? await propiedades.listarDePropietario(idInmobiliaria, idPersona) : []
  const ids = lista.map((propiedad) => propiedad.id)

  const [inquilinos, reportesDePropiedades, chat] = await Promise.all([
    contratos.inquilinosVigentes(idInmobiliaria, ids, hoy),
    reportes.listarDePropiedades(idInmobiliaria, ids, LIMITE_REPORTES),
    chatMasReciente(usuario),
  ])

  return {
    fecha: hoy,
    propiedades: resumenDePropiedades(lista, inquilinos),
    reportes: reportesDePropiedades,
    chat,
  }
}

const DIAS_POR_MES = 30.4375
const diasEntre = (desde, hasta) => (Date.parse(`${hasta}T00:00:00Z`) - Date.parse(`${desde}T00:00:00Z`)) / (24 * 60 * 60 * 1000)

function estadoDelAlquiler(contrato, hoy) {
  if (!contrato.fechaFin) {
    return { ...contrato, duracionMeses: null, mesesRestantes: null, porcentaje: null }
  }
  const total = diasEntre(contrato.fechaInicio, contrato.fechaFin)
  const transcurridos = Math.min(Math.max(diasEntre(contrato.fechaInicio, hoy), 0), total)
  return {
    ...contrato,
    duracionMeses: Math.round(total / DIAS_POR_MES),
    mesesRestantes: Math.round((total - transcurridos) / DIAS_POR_MES),
    porcentaje: total > 0 ? Math.round((transcurridos / total) * 100) : 100,
  }
}

async function resumenInquilino(usuario) {
  const hoy = fechaLocal()
  const idInmobiliaria = usuario.idInmobi

  const [avisos, idPersona] = await Promise.all([
    notificaciones.listarNoLeidas(usuario.id, idInmobiliaria, LIMITE_REPORTES),
    inquilinos.personaDelUsuario(usuario.id, idInmobiliaria),
  ])
  const contrato = idPersona ? await contratos.alquilerVigenteDe(idInmobiliaria, idPersona, hoy) : null

  if (!contrato) {
    return { fecha: hoy, notificaciones: avisos, alquiler: null, pagos: null, reportes: { total: 0, items: [] } }
  }

  const { inicio } = rangoDelDia(mesDe(hoy).siguiente)
  const [resumenPagos, reportesSinRevisar] = await Promise.all([
    pagos.resumenDeContrato(idInmobiliaria, contrato.id, inicio),
    reportes.listarDePropiedades(idInmobiliaria, [contrato.idPropiedad], LIMITE_REPORTES, { soloSinResolver: true }),
  ])

  return {
    fecha: hoy,
    notificaciones: avisos,
    alquiler: estadoDelAlquiler(contrato, hoy),
    pagos: resumenPagos,
    reportes: reportesSinRevisar,
  }
}

module.exports = { resumenAdministrador, resumenAgente, resumenPropietario, resumenInquilino }
