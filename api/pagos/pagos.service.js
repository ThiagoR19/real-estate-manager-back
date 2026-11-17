const db = require("../../db/conexion")
const enTransaccion = require("../../db/transaccion")
const { ADMIN, INQUILINO } = require("../../config/roles")
const { guardar } = require("../notificaciones/notificaciones.service")
const { fechaLocal, rangoDelDia } = require("../../utils/fechas")
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

async function contratoDeAlquiler(conexion, idInmobiliaria, idContrato, bloquear = false) {
  const [filas] = await conexion.execute(
    `SELECT
       c.id,
       c.idPropiedad,
       prop.nombre AS propiedad,
       tc.nombre AS tipo,
       ec.nombre AS estado,
       c.fechaInicio,
       ${FIN_EFECTIVO} AS fechaFin,
       c.montoAcordado,
       c.moneda
     FROM contratos c
     INNER JOIN tiposContratos tc
       ON tc.id = c.idTipoContrato
     INNER JOIN estadosContratos ec
       ON ec.id = c.idEstadoContrato
     INNER JOIN propiedades prop
       ON prop.id = c.idPropiedad
       AND prop.idInmobiliaria = c.idInmobiliaria
     WHERE c.idInmobiliaria = ?
       AND c.id = ?
     ${bloquear ? "FOR UPDATE" : ""}`,
    [idInmobiliaria, idContrato]
  )
  const contrato = filas[0]
  if (!contrato || contrato.tipo !== "Alquiler" || ESTADOS_SIN_VIGENCIA.includes(contrato.estado)) {
    return null
  }
  return {
    ...contrato,
    fechaInicio: comoFecha(contrato.fechaInicio),
    fechaFin: comoFecha(contrato.fechaFin),
    montoAcordado: Number(contrato.montoAcordado),
  }
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
  const [conceptos, comprobantes] = await Promise.all([
    conceptosDePago(usuario.idInmobi, id, conexion),
    comprobantesDePago(usuario.idInmobi, id, conexion),
  ])
  return { ...normalizar(filas[0]), conceptos, comprobantes }
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

async function avisarPago(conexion, usuario, pago, titulo, paraPersonal = false) {
  await guardar(conexion, {
    idInmobiliaria: usuario.idInmobi,
    tipo: "Pago",
    titulo,
    contenido: `${pago.propiedad}. Período ${pago.periodo.split("-").reverse().join("/")}.`,
    roles: paraPersonal ? [ADMIN] : [],
    idsPersonas: paraPersonal ? [] : [pago.idPersona],
    idAgente: paraPersonal ? pago.idAgente : null,
    excluirUsuario: usuario.id,
  })
}

async function crear(usuario, cuerpo) {
  return enTransaccion(async (conexion) => {
    const contrato = await contratoDeAlquiler(conexion, usuario.idInmobi, cuerpo.idContrato, true)
    if (!contrato) {
      return { error: "NO_ENCONTRADO", mensaje: "El contrato no existe o no es un alquiler activo" }
    }

    const inicio = `${cuerpo.periodo}-01`
    const antesDelInicio = contrato.fechaInicio && inicio < `${contrato.fechaInicio.slice(0, 7)}-01`
    const despuesDelFin = contrato.fechaFin && inicio > contrato.fechaFin
    if (antesDelInicio || despuesDelFin) {
      return { error: "DATOS_INVALIDOS", detalles: [{ campo: "periodo", problema: "El período está fuera de la vigencia del contrato" }] }
    }

    const [existentes] = await conexion.execute(
      `SELECT p.id FROM pagos p WHERE p.idInmobiliaria = ? AND p.idContrato = ? AND p.periodo = ?`,
      [usuario.idInmobi, cuerpo.idContrato, inicio]
    )
    if (existentes.length) {
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
      return { error: "CONFLICTO", mensaje: "El contrato no tiene inquilino" }
    }

    const lineas = await validarConceptos(conexion, usuario.idInmobi, cuerpo.conceptos)
    if (!lineas) {
      return { error: "NO_ENCONTRADO", mensaje: "Algún concepto no existe" }
    }

    const estados = await idsDeEstados(conexion)
    const [resultado] = await conexion.execute(
      `INSERT INTO pagos (idInmobiliaria, idContrato, idPersona, idEstado, periodo, monto, fechaVencimiento, detalle)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        usuario.idInmobi, cuerpo.idContrato, inquilinos[0].idPersona, estados.Pendiente, inicio, total(lineas),
        vencimiento(cuerpo.fechaVencimiento ?? `${cuerpo.periodo}-10`), cuerpo.detalle ?? null,
      ]
    )
    await guardarConceptos(conexion, usuario.idInmobi, resultado.insertId, lineas)
    const pago = await buscarPorId(usuario, resultado.insertId, conexion)
    await avisarPago(conexion, usuario, pago, "Nuevo pago de alquiler")
    return { pago }
  })
}

async function modificar(usuario, id, cuerpo) {
  return enTransaccion(async (conexion) => {
    const pago = await bloquearPago(conexion, usuario, id)
    if (!pago) {
      return { error: "NO_ENCONTRADO", mensaje: "El pago no existe" }
    }
    if (!EDITABLES.includes(pago.estado)) {
      return { error: "CONFLICTO", mensaje: "Solo se puede modificar un pago pendiente o rechazado" }
    }

    const lineas = await validarConceptos(conexion, usuario.idInmobi, cuerpo.conceptos)
    if (!lineas) {
      return { error: "NO_ENCONTRADO", mensaje: "Algún concepto no existe" }
    }

    await conexion.execute(
      `UPDATE pagos SET monto = ?, fechaVencimiento = ?, detalle = ? WHERE idInmobiliaria = ? AND id = ?`,
      [total(lineas), vencimiento(cuerpo.fechaVencimiento), cuerpo.detalle ?? null, usuario.idInmobi, id]
    )
    await guardarConceptos(conexion, usuario.idInmobi, id, lineas)
    return { pago: await buscarPorId(usuario, id, conexion) }
  })
}

async function eliminar(usuario, id) {
  return enTransaccion(async (conexion) => {
    const pago = await bloquearPago(conexion, usuario, id)
    if (!pago) {
      return { error: "NO_ENCONTRADO", mensaje: "El pago no existe" }
    }

    const [vinculos] = await conexion.execute(
      `SELECT
         (SELECT COUNT(*) FROM comprobantes co WHERE co.idInmobiliaria = ? AND co.idPago = ?) +
         (SELECT COUNT(*) FROM cobros cb WHERE cb.idInmobiliaria = ? AND cb.idPago = ?) AS total`,
      [usuario.idInmobi, id, usuario.idInmobi, id]
    )
    if (Number(vinculos[0].total)) {
      return { error: "CONFLICTO", mensaje: "El pago tiene comprobantes o liquidaciones vinculadas" }
    }

    await conexion.execute(`DELETE FROM pagosConceptos WHERE idInmobiliaria = ? AND idPago = ?`, [usuario.idInmobi, id])
    await conexion.execute(`DELETE FROM pagos WHERE idInmobiliaria = ? AND id = ?`, [usuario.idInmobi, id])
    return { pago: { id } }
  })
}

async function cargarComprobante(usuario, id, archivo) {
  const resultado = await enTransaccion(async (conexion) => {
    const pago = await bloquearPago(conexion, usuario, id)
    if (!pago) {
      return { error: "NO_ENCONTRADO", mensaje: "El pago no existe" }
    }
    if (!EDITABLES.includes(pago.estado)) {
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
    await conexion.execute(
      `INSERT INTO comprobantes (idInmobiliaria, idPago, idPersonaCarga, nombreArchivo, rutaArchivo) VALUES (?, ?, ?, ?, ?)`,
      [usuario.idInmobi, id, await personaDe(conexion, usuario), archivo.nombreArchivo, archivo.rutaArchivo]
    )
    return { pago: await buscarPorId(usuario, id, conexion), reemplazados: anteriores.map((fila) => fila.rutaArchivo) }
  })

  if (resultado.reemplazados) {
    await limpiar(resultado.reemplazados.map((nombre) => ({ destino: CARPETA, nombre, privado: true })))
  }
  return resultado
}

async function marcarPagado(usuario, id, { medioPago }) {
  return enTransaccion(async (conexion) => {
    const pago = await bloquearPago(conexion, usuario, id)
    if (!pago) {
      return { error: "NO_ENCONTRADO", mensaje: "El pago no existe" }
    }
    if (!EDITABLES.includes(pago.estado)) {
      return { error: "CONFLICTO", mensaje: `El pago ya está ${pago.estado.toLowerCase()}` }
    }

    const estados = await idsDeEstados(conexion)
    await conexion.execute(
      `UPDATE pagos SET idEstado = ?, fechaPago = ?, medioPago = COALESCE(?, medioPago) WHERE idInmobiliaria = ? AND id = ?`,
      [estados["En revision"], fechaLocal(), medioPago ?? null, usuario.idInmobi, id]
    )
    const actualizado = await buscarPorId(usuario, id, conexion)
    await avisarPago(conexion, usuario, actualizado, "Pago pendiente de revisión", true)
    return { pago: actualizado }
  })
}

async function aprobar(usuario, id, { medioPago }) {
  return enTransaccion(async (conexion) => {
    const pago = await bloquearPago(conexion, usuario, id)
    if (!pago) {
      return { error: "NO_ENCONTRADO", mensaje: "El pago no existe" }
    }
    if (["Aprobado", "Anulado"].includes(pago.estado)) {
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
       WHERE idInmobiliaria = ? AND idPago = ? AND estado = 'PENDIENTE'`,
      [await personaDe(conexion, usuario), usuario.idInmobi, id]
    )
    const actualizado = await buscarPorId(usuario, id, conexion)
    await avisarPago(conexion, usuario, actualizado, "Pago aprobado")
    return { pago: actualizado }
  })
}

async function rechazar(usuario, id, { motivo }) {
  return enTransaccion(async (conexion) => {
    const pago = await bloquearPago(conexion, usuario, id)
    if (!pago) {
      return { error: "NO_ENCONTRADO", mensaje: "El pago no existe" }
    }
    if (pago.estado !== "En revision") {
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
       WHERE idInmobiliaria = ? AND idPago = ? AND estado = 'PENDIENTE'`,
      [motivo, await personaDe(conexion, usuario), usuario.idInmobi, id]
    )
    const actualizado = await buscarPorId(usuario, id, conexion)
    await avisarPago(conexion, usuario, actualizado, "Pago rechazado")
    return { pago: actualizado }
  })
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
  enTransaccion,
  personaDe,
  listarConceptos,
  crearConcepto,
  validarConceptos,
  personasConAlquiler,
  listarInquilinos,
  contratoDeAlquiler,
  conceptosDePago,
  listar,
  buscarPorId,
  preparar,
  crear,
  modificar,
  eliminar,
  cargarComprobante,
  marcarPagado,
  aprobar,
  rechazar,
  comprobanteParaDescargar,
}
