const db = require("../../db/conexion")
const { ADMIN, AGENTE, INQUILINO } = require("../../config/roles")
const { guardar } = require("../notificaciones/notificaciones.service")
const { fechaLocal, mesDe, rangoDelDia } = require("../../utils/fechas")
const { limpiar } = require("../../utils/adjuntos")

const CARPETA = "comprobantes"
const ESTADOS_SIN_VIGENCIA = ["Borrador", "Anulado"]
const EDITABLES = ["Pendiente", "Rechazado"]
const FIN_EFECTIVO = "LEAST(COALESCE(c.fechaFin, c.fechaRescision), COALESCE(c.fechaRescision, c.fechaFin))"

const marcadores = (lista) => lista.map(() => "?").join(", ")
const comoFecha = (valor) => (valor ? valor.toISOString().slice(0, 10) : null)
const redondear = (valor) => Math.round(valor * 100) / 100
const total = (lineas) => redondear(lineas.reduce((suma, linea) => suma + linea.monto, 0))
const vencimiento = (dia) => rangoDelDia(dia).inicio

const SELECT_PAGO = `
  SELECT
    p.id,
    p.idContrato,
    c.idPropiedad,
    c.moneda,
    prop.nombre AS propiedad,
    prop.idAgente,
    p.idPersona,
    per.nombre,
    per.apellido,
    ep.nombre AS estado,
    p.periodo,
    p.monto,
    p.medioPago,
    p.fechaVencimiento,
    p.fechaPago,
    p.fechaRegistro,
    p.detalle,
    EXISTS (
      SELECT 1
      FROM comprobantes co
      WHERE co.idPago = p.id
        AND co.idInmobiliaria = p.idInmobiliaria
    ) AS tieneComprobante
  FROM pagos p
  INNER JOIN estadosPagos ep
    ON ep.id = p.idEstado
  INNER JOIN contratos c
    ON c.id = p.idContrato
    AND c.idInmobiliaria = p.idInmobiliaria
  INNER JOIN propiedades prop
    ON prop.id = c.idPropiedad
    AND prop.idInmobiliaria = c.idInmobiliaria
  INNER JOIN personas per
    ON per.id = p.idPersona
    AND per.idInmobiliaria = p.idInmobiliaria
`

const normalizar = (fila) => ({
  ...fila,
  periodo: comoFecha(fila.periodo).slice(0, 7),
  fechaPago: comoFecha(fila.fechaPago),
  monto: Number(fila.monto),
  tieneComprobante: Boolean(fila.tieneComprobante),
})

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

function alcance(usuario) {
  const condiciones = ["p.idInmobiliaria = ?"]
  const parametros = [usuario.idInmobi]
  if (usuario.rol === INQUILINO) {
    condiciones.push(`EXISTS (
      SELECT 1
      FROM contratosPersonas cpa
      INNER JOIN tiposParticipacion tpa
        ON tpa.id = cpa.idTipoParticipacion
      INNER JOIN usuarios ua
        ON ua.idPersona = cpa.idPersona
        AND ua.idInmobiliaria = cpa.idInmobiliaria
      WHERE cpa.idContrato = p.idContrato
        AND cpa.idInmobiliaria = p.idInmobiliaria
        AND tpa.nombre = 'Inquilino'
        AND ua.id = ?
    )`)
    parametros.push(usuario.id)
  }
  return { condiciones, parametros }
}

async function idsDeEstados(conexion) {
  const [filas] = await conexion.execute(`SELECT id, nombre FROM estadosPagos`)
  return Object.fromEntries(filas.map((fila) => [fila.nombre, fila.id]))
}

async function personaDe(conexion, usuario) {
  const [filas] = await conexion.execute(
    `SELECT u.idPersona FROM usuarios u WHERE u.id = ? AND u.idInmobiliaria = ?`,
    [usuario.id, usuario.idInmobi]
  )
  return filas[0]?.idPersona ?? null
}

async function listarConceptos(idInmobiliaria, conexion = db) {
  const [filas] = await conexion.execute(
    `SELECT
       cp.id,
       cp.nombre,
       cp.descripcion,
       cp.idInmobiliaria IS NULL AS global
     FROM conceptosPago cp
     WHERE cp.idInmobiliaria IS NULL
       OR cp.idInmobiliaria = ?
     ORDER BY cp.idInmobiliaria IS NOT NULL, cp.nombre`,
    [idInmobiliaria]
  )
  return filas.map((fila) => ({ ...fila, global: Boolean(fila.global) }))
}

async function crearConcepto(usuario, { nombre, descripcion }) {
  const [existentes] = await db.execute(
    `SELECT cp.id
     FROM conceptosPago cp
     WHERE cp.nombre = ?
       AND (cp.idInmobiliaria IS NULL OR cp.idInmobiliaria = ?)
     LIMIT 1`,
    [nombre, usuario.idInmobi]
  )
  if (existentes.length) {
    return { error: "CONFLICTO", mensaje: "Ya existe un concepto con ese nombre" }
  }

  const [resultado] = await db.execute(
    `INSERT INTO conceptosPago (idInmobiliaria, nombre, descripcion) VALUES (?, ?, ?)`,
    [usuario.idInmobi, nombre, descripcion ?? null]
  )
  return { concepto: { id: resultado.insertId, nombre, descripcion: descripcion ?? null, global: false } }
}

async function validarConceptos(conexion, idInmobiliaria, lista) {
  const ids = lista.map((concepto) => concepto.idConcepto)
  const [filas] = await conexion.execute(
    `SELECT cp.id, cp.tenantClave
     FROM conceptosPago cp
     WHERE cp.id IN (${marcadores(ids)})
       AND (cp.idInmobiliaria IS NULL OR cp.idInmobiliaria = ?)`,
    [...ids, idInmobiliaria]
  )
  if (filas.length !== ids.length) {
    return null
  }
  const claves = new Map(filas.map((fila) => [fila.id, fila.tenantClave]))
  return lista.map((concepto) => ({ ...concepto, tenantClave: claves.get(concepto.idConcepto) }))
}

async function personasConAlquiler(idInmobiliaria, rol, busqueda) {
  const condiciones = [
    "cp.idInmobiliaria = ?",
    "tp.nombre = ?",
    "tc.nombre = 'Alquiler'",
    `ec.nombre NOT IN (${marcadores(ESTADOS_SIN_VIGENCIA)})`,
  ]
  const parametros = [idInmobiliaria, rol, ...ESTADOS_SIN_VIGENCIA]
  if (busqueda) {
    condiciones.push("(per.nombre LIKE ? OR per.apellido LIKE ? OR prop.nombre LIKE ?)")
    const texto = `%${busqueda}%`
    parametros.push(texto, texto, texto)
  }

  const [filas] = await db.execute(
    `SELECT
       per.id AS idPersona,
       pr.id AS idPropietario,
       per.nombre,
       per.apellido,
       c.id AS idContrato,
       c.idPropiedad,
       prop.nombre AS propiedad,
       ec.nombre AS estadoContrato
     FROM contratosPersonas cp
     INNER JOIN tiposParticipacion tp
       ON tp.id = cp.idTipoParticipacion
     INNER JOIN personas per
       ON per.id = cp.idPersona
       AND per.idInmobiliaria = cp.idInmobiliaria
     LEFT JOIN propietarios pr
       ON pr.idPersona = per.id
       AND pr.idInmobiliaria = per.idInmobiliaria
     INNER JOIN contratos c
       ON c.id = cp.idContrato
       AND c.idInmobiliaria = cp.idInmobiliaria
     INNER JOIN tiposContratos tc
       ON tc.id = c.idTipoContrato
     INNER JOIN estadosContratos ec
       ON ec.id = c.idEstadoContrato
     INNER JOIN propiedades prop
       ON prop.id = c.idPropiedad
       AND prop.idInmobiliaria = c.idInmobiliaria
     WHERE ${condiciones.join(" AND ")}
     ORDER BY per.apellido, per.nombre, per.id, c.fechaInicio DESC, c.id DESC`,
    parametros
  )

  const personas = new Map()
  for (const { idContrato, idPropiedad, propiedad, estadoContrato, ...persona } of filas) {
    if (!personas.has(persona.idPersona)) personas.set(persona.idPersona, { ...persona, contratos: [] })
    personas.get(persona.idPersona).contratos.push({ idContrato, idPropiedad, propiedad, estadoContrato })
  }
  return [...personas.values()]
}

async function listarInquilinos(usuario, busqueda) {
  const personas = await personasConAlquiler(usuario.idInmobi, "Inquilino", busqueda)
  return personas.map(({ idPropietario, ...persona }) => persona)
}

const SELECT_CONTRATO_ALQUILER = `
    SELECT
       c.id,
       c.idPropiedad,
       prop.nombre AS propiedad,
       tc.nombre AS tipo,
       ec.nombre AS estado,
       c.fechaInicio,
       ${FIN_EFECTIVO} AS fechaFin,
       c.montoAcordado,
       c.moneda,
       c.periodicidadPago`

const FROM_CONTRATO_ALQUILER = `
     FROM contratos c
     INNER JOIN tiposContratos tc
       ON tc.id = c.idTipoContrato
     INNER JOIN estadosContratos ec
       ON ec.id = c.idEstadoContrato
     INNER JOIN propiedades prop
       ON prop.id = c.idPropiedad
       AND prop.idInmobiliaria = c.idInmobiliaria`

function normalizarContrato(contrato) {
  return {
    ...contrato,
    fechaInicio: comoFecha(contrato.fechaInicio),
    fechaFin: comoFecha(contrato.fechaFin),
    montoAcordado: Number(contrato.montoAcordado),
  }
}

async function contratoDeAlquiler(conexion, idInmobiliaria, idContrato, bloquear = false) {
  const [filas] = await conexion.execute(
    `${SELECT_CONTRATO_ALQUILER}${FROM_CONTRATO_ALQUILER}
     WHERE c.idInmobiliaria = ?
       AND c.id = ?
     ${bloquear ? "FOR UPDATE" : ""}`,
    [idInmobiliaria, idContrato]
  )
  const contrato = filas[0]
  if (!contrato || contrato.tipo !== "Alquiler" || ESTADOS_SIN_VIGENCIA.includes(contrato.estado)) {
    return null
  }
  return normalizarContrato(contrato)
}

async function contratosDelInquilino(conexion, usuario, idContrato) {
  const [filas] = await conexion.execute(
    `${SELECT_CONTRATO_ALQUILER}, u.idPersona${FROM_CONTRATO_ALQUILER}
     INNER JOIN contratosPersonas cp
       ON cp.idContrato = c.id AND cp.idInmobiliaria = c.idInmobiliaria
     INNER JOIN tiposParticipacion tp
       ON tp.id = cp.idTipoParticipacion AND tp.nombre = 'Inquilino'
     INNER JOIN usuarios u
       ON u.idPersona = cp.idPersona AND u.idInmobiliaria = cp.idInmobiliaria
     WHERE c.idInmobiliaria = ? AND u.id = ?
       AND tc.nombre = 'Alquiler'
       AND ec.nombre NOT IN (${marcadores(ESTADOS_SIN_VIGENCIA)})
     ${idContrato ? "AND c.id = ? FOR UPDATE" : "ORDER BY c.fechaInicio DESC, c.id DESC"}`,
    [usuario.idInmobi, usuario.id, ...ESTADOS_SIN_VIGENCIA, ...(idContrato ? [idContrato] : [])],
  )
  return filas.map(normalizarContrato)
}

function periodosDelContrato(contrato, actual) {
  const primero = contrato.fechaInicio?.slice(0, 7)
  const fin = contrato.fechaFin?.slice(0, 7)
  const ultimo = fin && fin < actual ? fin : actual
  if (contrato.periodicidadPago === "UNICO" && primero && primero <= ultimo) {
    return { primero, ultimo: primero }
  }
  return { primero, ultimo }
}

async function ajustesDeContratos(conexion, idInmobiliaria, ids) {
  const [filas] = await conexion.execute(
    `SELECT idContrato, fechaAplicacion, montoNuevo
     FROM ajustesAlquiler
     WHERE idInmobiliaria = ? AND idContrato IN (${marcadores(ids)})
     ORDER BY fechaAplicacion DESC`,
    [idInmobiliaria, ...ids],
  )
  const ajustes = new Map()
  for (const { idContrato, fechaAplicacion, montoNuevo } of filas) {
    if (!ajustes.has(idContrato)) ajustes.set(idContrato, [])
    ajustes.get(idContrato).push({ periodo: comoFecha(fechaAplicacion).slice(0, 7), monto: Number(montoNuevo) })
  }
  return ajustes
}

function montoParaPeriodo(contrato, periodo, ajustes) {
  return ajustes.get(contrato.id)?.find((ajuste) => ajuste.periodo <= periodo)?.monto ?? contrato.montoAcordado
}

async function listarContratosDisponibles(usuario) {
  if (usuario.rol !== INQUILINO) return { error: "SIN_PERMISO" }
  const contratos = await contratosDelInquilino(db, usuario)
  if (!contratos.length) return { contratos: [] }

  const ids = contratos.map(({ id }) => id)
  const [[pagos], ajustes] = await Promise.all([
    db.execute(
      `SELECT idContrato, periodo FROM pagos WHERE idInmobiliaria = ? AND idContrato IN (${marcadores(ids)})`,
      [usuario.idInmobi, ...ids],
    ),
    ajustesDeContratos(db, usuario.idInmobi, ids),
  ])
  const contratosConPagos = new Set(pagos.map(({ idContrato }) => idContrato))
  const ocupados = new Set(pagos.map(({ idContrato, periodo }) => `${idContrato}|${comoFecha(periodo).slice(0, 7)}`))
  const actual = fechaLocal().slice(0, 7)
  const disponibles = []

  for (const contrato of contratos) {
    const { id, idPropiedad, propiedad, moneda, periodicidadPago } = contrato
    const { primero, ultimo } = periodosDelContrato(contrato, actual)
    if (!primero || (periodicidadPago === "UNICO" && contratosConPagos.has(id))) continue

    const periodos = []
    for (let periodo = ultimo; periodo >= primero; periodo = mesDe(`${periodo}-01`).anterior.slice(0, 7)) {
      if (!ocupados.has(`${id}|${periodo}`)) {
        periodos.push({ periodo, monto: montoParaPeriodo(contrato, periodo, ajustes) })
      }
      if (periodo === primero) break
    }
    if (periodos.length) disponibles.push({ idContrato: id, idPropiedad, propiedad, moneda, periodos })
  }
  return { contratos: disponibles }
}

async function conceptosDePago(idInmobiliaria, idPago, conexion = db) {
  const [filas] = await conexion.execute(
    `SELECT
       pc.idConcepto,
       cp.nombre,
       pc.monto
     FROM pagosConceptos pc
     INNER JOIN conceptosPago cp
       ON cp.id = pc.idConcepto
     WHERE pc.idInmobiliaria = ?
       AND pc.idPago = ?
     ORDER BY cp.nombre`,
    [idInmobiliaria, idPago]
  )
  return filas.map((fila) => ({ ...fila, monto: Number(fila.monto) }))
}

async function comprobantesDePago(idInmobiliaria, idPago, conexion = db) {
  const [filas] = await conexion.execute(
    `SELECT
       co.id,
       co.nombreArchivo,
       co.estado,
       co.motivoRechazo,
       co.fechaCarga,
       co.fechaRevision
     FROM comprobantes co
     WHERE co.idInmobiliaria = ?
       AND co.idPago = ?
     ORDER BY co.fechaCarga DESC, co.id DESC`,
    [idInmobiliaria, idPago]
  )
  return filas
}

async function listar(usuario, filtros = {}) {
  const { page = 1, limit = 12 } = filtros
  const { condiciones, parametros } = alcance(usuario)

  if (filtros.idContrato) {
    condiciones.push("p.idContrato = ?")
    parametros.push(filtros.idContrato)
  }
  if (filtros.estado) {
    condiciones.push("ep.nombre = ?")
    parametros.push(filtros.estado)
  }
  if (filtros.anio) {
    condiciones.push("p.periodo >= ? AND p.periodo < ?")
    parametros.push(`${filtros.anio}-01-01`, `${filtros.anio + 1}-01-01`)
  }

  const donde = `WHERE ${condiciones.join(" AND ")}`
  const offset = (page - 1) * limit
  const [[filas], [conteo]] = await Promise.all([
    db.execute(`${SELECT_PAGO} ${donde} ORDER BY p.periodo DESC, p.id DESC LIMIT ? OFFSET ?`, [...parametros, limit, offset]),
    db.execute(
      `SELECT COUNT(*) AS total
       FROM pagos p
       INNER JOIN estadosPagos ep ON ep.id = p.idEstado
       ${donde}`,
      parametros
    ),
  ])

  const totalFilas = Number(conteo[0].total)
  return {
    items: filas.map(normalizar),
    paginacion: { pagina: page, limite: limit, total: totalFilas, paginas: Math.ceil(totalFilas / limit) },
  }
}

async function buscarPorId(usuario, id, conexion = db) {
  const { condiciones, parametros } = alcance(usuario)
  const [filas] = await conexion.execute(`${SELECT_PAGO} WHERE ${condiciones.join(" AND ")} AND p.id = ?`, [...parametros, id])
  if (!filas.length) {
    return null
  }
  const [conceptos, comprobantes, [liquidaciones]] = await Promise.all([
    conceptosDePago(usuario.idInmobi, id, conexion),
    comprobantesDePago(usuario.idInmobi, id, conexion),
    conexion.execute(
      `SELECT MAX(co.fechaCobro) AS fechaLiquidacion
       FROM cobros co
       INNER JOIN estadosCobros ec ON ec.id = co.idEstado
       WHERE co.idInmobiliaria = ? AND co.idPago = ? AND ec.nombre = 'Liquidado'`,
      [usuario.idInmobi, id]
    ),
  ])
  return { ...normalizar(filas[0]), conceptos, comprobantes, fechaLiquidacion: liquidaciones[0].fechaLiquidacion }
}

async function preparar(usuario, { idContrato, periodo }) {
  const contrato = await contratoDeAlquiler(db, usuario.idInmobi, idContrato)
  if (!contrato) {
    return { error: "NO_ENCONTRADO", mensaje: "El contrato no existe o no es un alquiler activo" }
  }

  const inicio = `${periodo}-01`
  const [[actual], [anterior]] = await Promise.all([
    db.execute(
      `SELECT p.id FROM pagos p WHERE p.idInmobiliaria = ? AND p.idContrato = ? AND p.periodo = ?`,
      [usuario.idInmobi, idContrato, inicio]
    ),
    db.execute(
      `SELECT p.id FROM pagos p WHERE p.idInmobiliaria = ? AND p.idContrato = ? AND p.periodo < ? ORDER BY p.periodo DESC LIMIT 1`,
      [usuario.idInmobi, idContrato, inicio]
    ),
  ])

  const [catalogo, lineasAnteriores, pago] = await Promise.all([
    listarConceptos(usuario.idInmobi),
    anterior.length ? conceptosDePago(usuario.idInmobi, anterior[0].id) : [],
    actual.length ? buscarPorId(usuario, actual[0].id) : null,
  ])

  const montos = new Map(lineasAnteriores.map((linea) => [linea.idConcepto, linea.monto]))
  return {
    datos: {
      contrato,
      periodo,
      pago,
      conceptos: catalogo.map((concepto) => ({
        ...concepto,
        activoAnterior: montos.has(concepto.id),
        montoAnterior: montos.get(concepto.id) ?? 0,
      })),
    },
  }
}

async function guardarConceptos(conexion, idInmobiliaria, idPago, lineas) {
  await conexion.execute(`DELETE FROM pagosConceptos WHERE idInmobiliaria = ? AND idPago = ?`, [idInmobiliaria, idPago])
  for (const linea of lineas) {
    await conexion.execute(
      `INSERT INTO pagosConceptos (idInmobiliaria, idConcepto, conceptoTenantClave, idPago, monto) VALUES (?, ?, ?, ?, ?)`,
      [idInmobiliaria, linea.idConcepto, linea.tenantClave, idPago, linea.monto]
    )
  }
}

async function insertarPago(conexion, idInmobiliaria, idPersona, datos, lineas) {
  const { idContrato, periodo, fechaVencimiento, detalle } = datos
  const estados = await idsDeEstados(conexion)
  const [resultado] = await conexion.execute(
    `INSERT INTO pagos (idInmobiliaria, idContrato, idPersona, idEstado, periodo, monto, fechaVencimiento, detalle)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      idInmobiliaria, idContrato, idPersona, estados.Pendiente, `${periodo}-01`, total(lineas),
      vencimiento(fechaVencimiento ?? `${periodo}-10`), detalle ?? null,
    ],
  )
  const id = resultado.insertId
  await guardarConceptos(conexion, idInmobiliaria, id, lineas)
  return id
}

async function conceptoDeAlquiler(conexion, idInmobiliaria, periodicidadPago) {
  const nombre = periodicidadPago === "UNICO" ? "Alquiler" : "Alquiler mensual"
  const [filas] = await conexion.execute(
    `SELECT id AS idConcepto, tenantClave FROM conceptosPago
     WHERE nombre = ? AND (idInmobiliaria IS NULL OR idInmobiliaria = ?)
     ORDER BY idInmobiliaria IS NOT NULL LIMIT 1`,
    [nombre, idInmobiliaria],
  )
  if (filas.length) return filas[0]

  const [resultado] = await conexion.execute(
    `INSERT INTO conceptosPago (idInmobiliaria, nombre) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
    [idInmobiliaria, nombre],
  )
  return { idConcepto: resultado.insertId, tenantClave: idInmobiliaria }
}

async function bloquearPago(conexion, usuario, id) {
  const { condiciones, parametros } = alcance(usuario)
  const [filas] = await conexion.execute(
    `SELECT p.id, ep.nombre AS estado
     FROM pagos p
     INNER JOIN estadosPagos ep
       ON ep.id = p.idEstado
     WHERE ${condiciones.join(" AND ")}
       AND p.id = ?
     FOR UPDATE`,
    [...parametros, id]
  )
  return filas[0] || null
}

async function comprobanteSigueEnRevision(conexion, usuario, pago, idComprobante) {
  if (pago.estado !== "En revision") return false
  const [comprobantes] = await conexion.execute(
    `SELECT id FROM comprobantes
     WHERE idInmobiliaria = ? AND idPago = ? AND estado = 'PENDIENTE'
     ORDER BY fechaCarga DESC, id DESC
     LIMIT 1 FOR UPDATE`,
    [usuario.idInmobi, pago.id]
  )
  return comprobantes[0]?.id === idComprobante
}

const ERROR_REVISION_CAMBIO = {
  error: "CONFLICTO",
  mensaje: "El pago o el comprobante cambió. Actualizá el detalle antes de resolverlo",
}

async function avisarPago(conexion, usuario, pago, titulo, paraPersonal = false) {
  return guardar(conexion, {
    idInmobiliaria: usuario.idInmobi,
    tipo: "Pago",
    titulo,
    contenido: `${pago.propiedad}. Período ${pago.periodo.split("-").reverse().join("/")}.`,
    roles: paraPersonal ? rolesParaRevision(pago.idAgente) : [],
    idsPersonas: paraPersonal ? [] : [pago.idPersona],
    idAgente: paraPersonal ? pago.idAgente : null,
    excluirUsuario: usuario.id,
  })
}

function rolesParaRevision(idAgente) {
  return idAgente ? [ADMIN] : [ADMIN, AGENTE]
}

async function notificarSolicitudRevision(usuario, registro, motivo, tipoRegistro) {
  const conexion = await db.getConnection()
  try {
    await conexion.beginTransaction()
    const [personas] = await conexion.execute(
      `SELECT p.nombre, p.apellido
       FROM usuarios u
       INNER JOIN personas p ON p.id = u.idPersona AND p.idInmobiliaria = u.idInmobiliaria
       WHERE u.idInmobiliaria = ? AND u.id = ?`,
      [usuario.idInmobi, usuario.id]
    )
    const solicitante = personas[0]
    if (!solicitante) {
      await conexion.rollback()
      return { error: "SIN_PERMISO" }
    }

    const aviso = await guardar(conexion, {
      idInmobiliaria: usuario.idInmobi,
      tipo: "Pago",
      titulo: `Solicitud de revisión de ${tipoRegistro}`,
      contenido: `${solicitante.nombre} ${solicitante.apellido}. ${registro.propiedad}. Período ${registro.periodo.split("-").reverse().join("/")}. ${motivo}`,
      roles: rolesParaRevision(registro.idAgente),
      idAgente: registro.idAgente,
      excluirUsuario: usuario.id,
    })
    if (!aviso) {
      await conexion.rollback()
      return { error: "CONFLICTO", mensaje: "La inmobiliaria no tiene personal disponible para recibir la solicitud" }
    }
    await conexion.commit()
    return { solicitud: { id: aviso.notificacion.id }, aviso }
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}

async function solicitarRevision(usuario, id, motivo) {
  const pago = await buscarPorId(usuario, id)
  if (!pago) return { error: "NO_ENCONTRADO", mensaje: "El pago no existe" }
  return notificarSolicitudRevision(usuario, pago, motivo, "pago")
}

async function crear(usuario, cuerpo) {
  const conexion = await db.getConnection()
  try {
    await conexion.beginTransaction()
    const contrato = await contratoDeAlquiler(conexion, usuario.idInmobi, cuerpo.idContrato, true)
    if (!contrato) {
      await conexion.rollback()
      return { error: "NO_ENCONTRADO", mensaje: "El contrato no existe o no es un alquiler activo" }
    }

    const inicio = `${cuerpo.periodo}-01`
    const antesDelInicio = contrato.fechaInicio && inicio < `${contrato.fechaInicio.slice(0, 7)}-01`
    const despuesDelFin = contrato.fechaFin && inicio > contrato.fechaFin
    if (antesDelInicio || despuesDelFin) {
      await conexion.rollback()
      return { error: "DATOS_INVALIDOS", detalles: [{ campo: "periodo", problema: "El período está fuera de la vigencia del contrato" }] }
    }

    const [existentes] = await conexion.execute(
      `SELECT p.id FROM pagos p WHERE p.idInmobiliaria = ? AND p.idContrato = ? AND p.periodo = ?`,
      [usuario.idInmobi, cuerpo.idContrato, inicio]
    )
    if (existentes.length) {
      await conexion.rollback()
      return { error: "CONFLICTO", mensaje: "Ya se envió el cobro de ese período" }
    }

    const [inquilinos] = await conexion.execute(
      `SELECT cp.idPersona
       FROM contratosPersonas cp
       INNER JOIN tiposParticipacion tp
         ON tp.id = cp.idTipoParticipacion
       WHERE cp.idInmobiliaria = ?
         AND cp.idContrato = ?
         AND tp.nombre = 'Inquilino'
       ORDER BY cp.id
       LIMIT 1`,
      [usuario.idInmobi, cuerpo.idContrato]
    )
    if (!inquilinos.length) {
      await conexion.rollback()
      return { error: "CONFLICTO", mensaje: "El contrato no tiene inquilino" }
    }

    const lineas = await validarConceptos(conexion, usuario.idInmobi, cuerpo.conceptos)
    if (!lineas) {
      await conexion.rollback()
      return { error: "NO_ENCONTRADO", mensaje: "Algún concepto no existe" }
    }

    const id = await insertarPago(conexion, usuario.idInmobi, inquilinos[0].idPersona, cuerpo, lineas)
    const pago = await buscarPorId(usuario, id, conexion)
    await avisarPago(conexion, usuario, pago, "Nuevo pago de alquiler")
    await conexion.commit()
    return { pago }
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}

async function modificar(usuario, id, cuerpo) {
  const conexion = await db.getConnection()
  try {
    await conexion.beginTransaction()
    const pago = await bloquearPago(conexion, usuario, id)
    if (!pago) {
      await conexion.rollback()
      return { error: "NO_ENCONTRADO", mensaje: "El pago no existe" }
    }
    if (!EDITABLES.includes(pago.estado)) {
      await conexion.rollback()
      return { error: "CONFLICTO", mensaje: "Solo se puede modificar un pago pendiente o rechazado" }
    }

    const lineas = await validarConceptos(conexion, usuario.idInmobi, cuerpo.conceptos)
    if (!lineas) {
      await conexion.rollback()
      return { error: "NO_ENCONTRADO", mensaje: "Algún concepto no existe" }
    }

    await conexion.execute(
      `UPDATE pagos SET monto = ?, fechaVencimiento = ?, detalle = ? WHERE idInmobiliaria = ? AND id = ?`,
      [total(lineas), vencimiento(cuerpo.fechaVencimiento), cuerpo.detalle ?? null, usuario.idInmobi, id]
    )
    await guardarConceptos(conexion, usuario.idInmobi, id, lineas)
    const respuesta = { pago: await buscarPorId(usuario, id, conexion) }
    await conexion.commit()
    return respuesta
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}

async function eliminar(usuario, id) {
  const conexion = await db.getConnection()
  try {
    await conexion.beginTransaction()
    const pago = await bloquearPago(conexion, usuario, id)
    if (!pago) {
      await conexion.rollback()
      return { error: "NO_ENCONTRADO", mensaje: "El pago no existe" }
    }

    const [vinculos] = await conexion.execute(
      `SELECT
         (SELECT COUNT(*) FROM comprobantes co WHERE co.idInmobiliaria = ? AND co.idPago = ?) +
         (SELECT COUNT(*) FROM cobros cb WHERE cb.idInmobiliaria = ? AND cb.idPago = ?) AS total`,
      [usuario.idInmobi, id, usuario.idInmobi, id]
    )
    if (Number(vinculos[0].total)) {
      await conexion.rollback()
      return { error: "CONFLICTO", mensaje: "El pago tiene comprobantes o liquidaciones vinculadas" }
    }

    await conexion.execute(`DELETE FROM pagosConceptos WHERE idInmobiliaria = ? AND idPago = ?`, [usuario.idInmobi, id])
    await conexion.execute(`DELETE FROM pagos WHERE idInmobiliaria = ? AND id = ?`, [usuario.idInmobi, id])
    await conexion.commit()
    return { pago: { id } }
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}

async function pasarPagoARevision(conexion, usuario, id, medioPago) {
  const estados = await idsDeEstados(conexion)
  await conexion.execute(
    `UPDATE pagos SET idEstado = ?, fechaPago = ?, medioPago = COALESCE(?, medioPago) WHERE idInmobiliaria = ? AND id = ?`,
    [estados["En revision"], fechaLocal(), medioPago ?? null, usuario.idInmobi, id]
  )
  const pago = await buscarPorId(usuario, id, conexion)
  const aviso = await avisarPago(conexion, usuario, pago, "Pago pendiente de revisión", true)
  return { pago, aviso }
}

async function insertarComprobante(conexion, idInmobiliaria, idPago, idPersona, archivo) {
  await conexion.execute(
    `INSERT INTO comprobantes (idInmobiliaria, idPago, idPersonaCarga, nombreArchivo, rutaArchivo) VALUES (?, ?, ?, ?, ?)`,
    [idInmobiliaria, idPago, idPersona, archivo.nombreArchivo, archivo.rutaArchivo],
  )
}

const ERROR_PERIODO_REGISTRADO = { error: "CONFLICTO", mensaje: "Ya hay un pago registrado para este período" }

async function registrarConComprobante(usuario, { idContrato, periodo }, archivo) {
  if (usuario.rol !== INQUILINO) return { error: "SIN_PERMISO" }

  const conexion = await db.getConnection()
  const idInmobiliaria = usuario.idInmobi
  try {
    await conexion.beginTransaction()
    const [contrato] = await contratosDelInquilino(conexion, usuario, idContrato)
    if (!contrato) {
      await conexion.rollback()
      return { error: "NO_ENCONTRADO", mensaje: "No se encontró un contrato de alquiler vinculado a tu cuenta" }
    }

    const { primero, ultimo } = periodosDelContrato(contrato, fechaLocal().slice(0, 7))
    if (!primero || periodo < primero || periodo > ultimo) {
      await conexion.rollback()
      return { error: "DATOS_INVALIDOS", mensaje: "El período no está disponible para este contrato" }
    }

    const pagoUnico = contrato.periodicidadPago === "UNICO"
    const [existentes] = await conexion.execute(
      `SELECT id FROM pagos WHERE idInmobiliaria = ? AND idContrato = ?${pagoUnico ? "" : " AND periodo = ?"} LIMIT 1 FOR UPDATE`,
      [idInmobiliaria, idContrato, ...(pagoUnico ? [] : [`${periodo}-01`])],
    )
    if (existentes.length) {
      await conexion.rollback()
      return ERROR_PERIODO_REGISTRADO
    }

    const ajustes = await ajustesDeContratos(conexion, idInmobiliaria, [idContrato])
    const concepto = await conceptoDeAlquiler(conexion, idInmobiliaria, contrato.periodicidadPago)
    const monto = montoParaPeriodo(contrato, periodo, ajustes)
    const id = await insertarPago(conexion, idInmobiliaria, contrato.idPersona, { idContrato, periodo }, [{ ...concepto, monto }])
    await insertarComprobante(conexion, idInmobiliaria, id, contrato.idPersona, archivo)
    const resultado = await pasarPagoARevision(conexion, usuario, id)
    await conexion.commit()
    return resultado
  } catch (error) {
    await conexion.rollback()
    if (error.code === "ER_DUP_ENTRY" && error.sqlMessage?.includes("uq_Pagos_contrato_periodo")) {
      return ERROR_PERIODO_REGISTRADO
    }
    throw error
  } finally {
    conexion.release()
  }
}

async function cargarComprobante(usuario, id, archivo, { enviar = false } = {}) {
  if (enviar && usuario.rol !== INQUILINO) return { error: "SIN_PERMISO" }
  const conexion = await db.getConnection()
  let resultado
  try {
    await conexion.beginTransaction()
    const pago = await bloquearPago(conexion, usuario, id)
    if (!pago) {
      await conexion.rollback()
      return { error: "NO_ENCONTRADO", mensaje: "El pago no existe" }
    }
    if (!EDITABLES.includes(pago.estado)) {
      await conexion.rollback()
      return { error: "CONFLICTO", mensaje: "Solo se puede cargar un comprobante en un pago pendiente o rechazado" }
    }

    const [anteriores] = await conexion.execute(
      `SELECT co.rutaArchivo FROM comprobantes co WHERE co.idInmobiliaria = ? AND co.idPago = ? AND co.estado = 'PENDIENTE'`,
      [usuario.idInmobi, id]
    )
    await conexion.execute(
      `DELETE FROM comprobantes WHERE idInmobiliaria = ? AND idPago = ? AND estado = 'PENDIENTE'`,
      [usuario.idInmobi, id]
    )
    await insertarComprobante(conexion, usuario.idInmobi, id, await personaDe(conexion, usuario), archivo)
    const datos = enviar
      ? await pasarPagoARevision(conexion, usuario, id)
      : { pago: await buscarPorId(usuario, id, conexion) }
    resultado = { ...datos, reemplazados: anteriores.map((fila) => fila.rutaArchivo) }
    await conexion.commit()
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }

  if (resultado.reemplazados) {
    await limpiar(resultado.reemplazados.map((nombre) => ({ destino: CARPETA, nombre, privado: true })))
  }
  return resultado
}

async function marcarPagado(usuario, id, { medioPago }) {
  const conexion = await db.getConnection()
  try {
    await conexion.beginTransaction()
    const pago = await bloquearPago(conexion, usuario, id)
    if (!pago) {
      await conexion.rollback()
      return { error: "NO_ENCONTRADO", mensaje: "El pago no existe" }
    }
    if (!EDITABLES.includes(pago.estado)) {
      await conexion.rollback()
      return { error: "CONFLICTO", mensaje: `El pago ya está ${pago.estado.toLowerCase()}` }
    }

    if (medioPago !== "EFECTIVO") {
      const [comprobantes] = await conexion.execute(
        `SELECT 1 FROM comprobantes WHERE idInmobiliaria = ? AND idPago = ? AND estado = 'PENDIENTE' LIMIT 1`,
        [usuario.idInmobi, id]
      )
      if (!comprobantes.length) {
        await conexion.rollback()
        return { error: "CONFLICTO", mensaje: "Cargá un comprobante antes de enviar el pago a revisión" }
      }
    }
    const resultado = await pasarPagoARevision(conexion, usuario, id, medioPago)
    await conexion.commit()
    return resultado
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}

async function aprobar(usuario, id, { medioPago, idComprobante }) {
  const conexion = await db.getConnection()
  try {
    await conexion.beginTransaction()
    const pago = await bloquearPago(conexion, usuario, id)
    if (!pago) {
      await conexion.rollback()
      return { error: "NO_ENCONTRADO", mensaje: "El pago no existe" }
    }
    if (idComprobante !== undefined && !(await comprobanteSigueEnRevision(conexion, usuario, pago, idComprobante))) {
      await conexion.rollback()
      return ERROR_REVISION_CAMBIO
    }
    if (["Aprobado", "Anulado"].includes(pago.estado)) {
      await conexion.rollback()
      return { error: "CONFLICTO", mensaje: `El pago ya está ${pago.estado.toLowerCase()} y no puede modificarse` }
    }

    const estados = await idsDeEstados(conexion)
    await conexion.execute(
      `UPDATE pagos SET idEstado = ?, fechaPago = COALESCE(fechaPago, ?), medioPago = COALESCE(?, medioPago) WHERE idInmobiliaria = ? AND id = ?`,
      [estados.Aprobado, fechaLocal(), medioPago ?? null, usuario.idInmobi, id]
    )
    await conexion.execute(
      `UPDATE comprobantes
       SET estado = 'APROBADO', idPersonaRevisora = ?, fechaRevision = CURRENT_TIMESTAMP
       WHERE idInmobiliaria = ? AND idPago = ? AND estado = 'PENDIENTE' AND id = COALESCE(?, id)`,
      [await personaDe(conexion, usuario), usuario.idInmobi, id, idComprobante ?? null]
    )
    const actualizado = await buscarPorId(usuario, id, conexion)
    const aviso = await avisarPago(conexion, usuario, actualizado, "Pago aprobado")
    await conexion.commit()
    return { pago: actualizado, aviso }
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}

async function rechazar(usuario, id, { motivo, idComprobante }) {
  const conexion = await db.getConnection()
  try {
    await conexion.beginTransaction()
    const pago = await bloquearPago(conexion, usuario, id)
    if (!pago) {
      await conexion.rollback()
      return { error: "NO_ENCONTRADO", mensaje: "El pago no existe" }
    }
    if (idComprobante !== undefined && !(await comprobanteSigueEnRevision(conexion, usuario, pago, idComprobante))) {
      await conexion.rollback()
      return ERROR_REVISION_CAMBIO
    }
    if (pago.estado !== "En revision") {
      await conexion.rollback()
      return { error: "CONFLICTO", mensaje: "Solo se puede rechazar un pago en revisión" }
    }

    const estados = await idsDeEstados(conexion)
    await conexion.execute(
      `UPDATE pagos SET idEstado = ? WHERE idInmobiliaria = ? AND id = ?`,
      [estados.Rechazado, usuario.idInmobi, id]
    )
    await conexion.execute(
      `UPDATE comprobantes
       SET estado = 'RECHAZADO', motivoRechazo = ?, idPersonaRevisora = ?, fechaRevision = CURRENT_TIMESTAMP
       WHERE idInmobiliaria = ? AND idPago = ? AND estado = 'PENDIENTE' AND id = COALESCE(?, id)`,
      [motivo, await personaDe(conexion, usuario), usuario.idInmobi, id, idComprobante ?? null]
    )
    const actualizado = await buscarPorId(usuario, id, conexion)
    const aviso = await avisarPago(conexion, usuario, actualizado, "Pago rechazado")
    await conexion.commit()
    return { pago: actualizado, aviso }
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}

async function comprobanteParaDescargar(usuario, id) {
  const { condiciones, parametros } = alcance(usuario)
  const [filas] = await db.execute(
    `SELECT co.nombreArchivo, co.rutaArchivo
     FROM comprobantes co
     INNER JOIN pagos p
       ON p.id = co.idPago
       AND p.idInmobiliaria = co.idInmobiliaria
     WHERE ${condiciones.join(" AND ")}
       AND p.id = ?
     ORDER BY co.fechaCarga DESC, co.id DESC
     LIMIT 1`,
    [...parametros, id]
  )
  return filas[0] || null
}

module.exports = {
  contarAprobados,
  resumenDeContrato,
  personaDe,
  listarConceptos,
  crearConcepto,
  validarConceptos,
  personasConAlquiler,
  listarInquilinos,
  contratoDeAlquiler,
  conceptosDePago,
  listar,
  listarContratosDisponibles,
  buscarPorId,
  preparar,
  crear,
  modificar,
  eliminar,
  cargarComprobante,
  registrarConComprobante,
  solicitarRevision,
  notificarSolicitudRevision,
  marcarPagado,
  aprobar,
  rechazar,
  comprobanteParaDescargar,
}
