const db = require("../../db/conexion")
const pagos = require("../pagos/pagos.service")
const { PROPIETARIO } = require("../../config/roles")
const { limpiar } = require("../../utils/adjuntos")
const { guardar } = require("../notificaciones/notificaciones.service")

const CARPETA = "comprobantes"

const comoFecha = (valor) => (valor ? valor.toISOString().slice(0, 10) : null)
const redondear = (valor) => Math.round(valor * 100) / 100
const sumar = (lineas) => redondear(lineas.reduce((suma, linea) => suma + linea.monto, 0))

const SELECT_COBRO = `
  SELECT
    co.id,
    co.idPago,
    co.idPropietario,
    per.nombre,
    per.apellido,
    p.idContrato,
    c.idPropiedad,
    c.moneda,
    prop.nombre AS propiedad,
    prop.idAgente,
    p.periodo,
    p.fechaPago AS fechaPagoInquilino,
    ec.nombre AS estado,
    co.montoBruto,
    co.porcentajeComision,
    co.comision,
    co.descuentos,
    co.montoNeto,
    co.fechaGeneracion,
    co.fechaCobro,
    co.detalle,
    co.nombreArchivo,
    co.fechaComprobante
  FROM cobros co
  INNER JOIN estadosCobros ec
    ON ec.id = co.idEstado
  INNER JOIN pagos p
    ON p.id = co.idPago
    AND p.idInmobiliaria = co.idInmobiliaria
  INNER JOIN contratos c
    ON c.id = p.idContrato
    AND c.idInmobiliaria = p.idInmobiliaria
  INNER JOIN propiedades prop
    ON prop.id = c.idPropiedad
    AND prop.idInmobiliaria = c.idInmobiliaria
  INNER JOIN propietarios pr
    ON pr.id = co.idPropietario
    AND pr.idInmobiliaria = co.idInmobiliaria
  INNER JOIN personas per
    ON per.id = pr.idPersona
    AND per.idInmobiliaria = pr.idInmobiliaria
`

const normalizar = (fila) => ({
  ...fila,
  periodo: comoFecha(fila.periodo).slice(0, 7),
  fechaPagoInquilino: comoFecha(fila.fechaPagoInquilino),
  montoBruto: Number(fila.montoBruto),
  porcentajeComision: fila.porcentajeComision === null ? null : Number(fila.porcentajeComision),
  comision: Number(fila.comision),
  descuentos: Number(fila.descuentos),
  montoNeto: Number(fila.montoNeto),
  tieneComprobante: Boolean(fila.nombreArchivo),
})

function alcance(usuario) {
  const condiciones = ["co.idInmobiliaria = ?"]
  const parametros = [usuario.idInmobi]
  if (usuario.rol === PROPIETARIO) {
    condiciones.push(`EXISTS (
      SELECT 1
      FROM propietarios pra
      INNER JOIN usuarios ua
        ON ua.idPersona = pra.idPersona
        AND ua.idInmobiliaria = pra.idInmobiliaria
      WHERE pra.id = co.idPropietario
        AND pra.idInmobiliaria = co.idInmobiliaria
        AND ua.id = ?
    )`)
    parametros.push(usuario.id)
  }
  return { condiciones, parametros }
}

async function idsDeEstados(conexion) {
  const [filas] = await conexion.execute(`SELECT id, nombre FROM estadosCobros`)
  return Object.fromEntries(filas.map((fila) => [fila.nombre, fila.id]))
}

async function esPropietarioDelContrato(conexion, idInmobiliaria, idPropietario, idContrato) {
  const [filas] = await conexion.execute(
    `SELECT pr.id
     FROM propietarios pr
     INNER JOIN contratosPersonas cp
       ON cp.idPersona = pr.idPersona
       AND cp.idInmobiliaria = pr.idInmobiliaria
     INNER JOIN tiposParticipacion tp
       ON tp.id = cp.idTipoParticipacion
     WHERE pr.idInmobiliaria = ?
       AND pr.id = ?
       AND cp.idContrato = ?
       AND tp.nombre = 'Propietario'
     LIMIT 1`,
    [idInmobiliaria, idPropietario, idContrato]
  )
  return filas.length > 0
}

function calcular(cuerpo) {
  const montoBruto = sumar(cuerpo.conceptos.filter((concepto) => concepto.monto > 0))
  const descuentos = Math.abs(sumar(cuerpo.conceptos.filter((concepto) => concepto.monto < 0)))
  const comision = cuerpo.porcentajeComision !== undefined
    ? redondear((montoBruto * cuerpo.porcentajeComision) / 100)
    : cuerpo.comision ?? 0
  return { montoBruto, descuentos, comision, porcentajeComision: cuerpo.porcentajeComision ?? null }
}

async function conceptosDeCobro(idInmobiliaria, idCobro, conexion = db) {
  const [filas] = await conexion.execute(
    `SELECT
       cc.idConcepto,
       cp.nombre,
       cc.monto
     FROM cobrosConceptos cc
     INNER JOIN conceptosPago cp
       ON cp.id = cc.idConcepto
     WHERE cc.idInmobiliaria = ?
       AND cc.idCobro = ?
     ORDER BY cc.monto < 0, cp.nombre`,
    [idInmobiliaria, idCobro]
  )
  return filas.map((fila) => ({ ...fila, monto: Number(fila.monto) }))
}

async function listarPropietarios(usuario, busqueda) {
  const personas = await pagos.personasConAlquiler(usuario.idInmobi, "Propietario", busqueda)
  return personas.filter((persona) => persona.idPropietario)
}

async function listar(usuario, filtros = {}) {
  const { page = 1, limit = 12 } = filtros
  const { condiciones, parametros } = alcance(usuario)

  if (filtros.idPropietario) {
    condiciones.push("co.idPropietario = ?")
    parametros.push(filtros.idPropietario)
  }
  if (filtros.idContrato) {
    condiciones.push("p.idContrato = ?")
    parametros.push(filtros.idContrato)
  }
  if (filtros.estado) {
    condiciones.push("ec.nombre = ?")
    parametros.push(filtros.estado)
  }
  if (filtros.anio) {
    condiciones.push("p.periodo >= ? AND p.periodo < ?")
    parametros.push(`${filtros.anio}-01-01`, `${filtros.anio + 1}-01-01`)
  }

  const donde = `WHERE ${condiciones.join(" AND ")}`
  const offset = (page - 1) * limit
  const [[filas], [conteo]] = await Promise.all([
    db.execute(`${SELECT_COBRO} ${donde} ORDER BY p.periodo DESC, co.id DESC LIMIT ? OFFSET ?`, [...parametros, limit, offset]),
    db.execute(
      `SELECT COUNT(*) AS total
       FROM cobros co
       INNER JOIN estadosCobros ec ON ec.id = co.idEstado
       INNER JOIN pagos p ON p.id = co.idPago AND p.idInmobiliaria = co.idInmobiliaria
       ${donde}`,
      parametros
    ),
  ])

  const total = Number(conteo[0].total)
  return {
    items: filas.map(normalizar),
    paginacion: { pagina: page, limite: limit, total, paginas: Math.ceil(total / limit) },
  }
}

async function buscarPorId(usuario, id, conexion = db) {
  const { condiciones, parametros } = alcance(usuario)
  const [filas] = await conexion.execute(`${SELECT_COBRO} WHERE ${condiciones.join(" AND ")} AND co.id = ?`, [...parametros, id])
  if (!filas.length) {
    return null
  }
  return { ...normalizar(filas[0]), conceptos: await conceptosDeCobro(usuario.idInmobi, id, conexion) }
}

async function solicitarRevision(usuario, id, motivo) {
  const cobro = await buscarPorId(usuario, id)
  if (!cobro) return { error: "NO_ENCONTRADO", mensaje: "La liquidación no existe" }
  return pagos.notificarSolicitudRevision(usuario, cobro, motivo, "liquidación")
}

async function preparar(usuario, { idContrato, idPropietario, periodo }) {
  const contrato = await pagos.contratoDeAlquiler(db, usuario.idInmobi, idContrato)
  if (!contrato) {
    return { error: "NO_ENCONTRADO", mensaje: "El contrato no existe o no es un alquiler activo" }
  }
  if (!(await esPropietarioDelContrato(db, usuario.idInmobi, idPropietario, idContrato))) {
    return { error: "NO_ENCONTRADO", mensaje: "El propietario no es parte del contrato" }
  }

  const inicio = `${periodo}-01`
  const [[pagosDelPeriodo], [anterior]] = await Promise.all([
    db.execute(
      `SELECT p.id FROM pagos p WHERE p.idInmobiliaria = ? AND p.idContrato = ? AND p.periodo = ?`,
      [usuario.idInmobi, idContrato, inicio]
    ),
    db.execute(
      `SELECT co.id
       FROM cobros co
       INNER JOIN pagos p
         ON p.id = co.idPago
         AND p.idInmobiliaria = co.idInmobiliaria
       WHERE co.idInmobiliaria = ?
         AND co.idPropietario = ?
         AND p.idContrato = ?
         AND p.periodo < ?
       ORDER BY p.periodo DESC
       LIMIT 1`,
      [usuario.idInmobi, idPropietario, idContrato, inicio]
    ),
  ])

  const idPago = pagosDelPeriodo[0]?.id ?? null
  const [actual] = idPago
    ? await db.execute(
      `SELECT co.id FROM cobros co WHERE co.idInmobiliaria = ? AND co.idPago = ? AND co.idPropietario = ?`,
      [usuario.idInmobi, idPago, idPropietario]
    )
    : [[]]

  const [catalogo, lineasAnteriores, pago, cobro] = await Promise.all([
    pagos.listarConceptos(usuario.idInmobi),
    anterior.length ? conceptosDeCobro(usuario.idInmobi, anterior[0].id) : [],
    idPago ? pagos.buscarPorId(usuario, idPago) : null,
    actual.length ? buscarPorId(usuario, actual[0].id) : null,
  ])

  const montosPago = new Map((pago?.conceptos ?? []).map((linea) => [linea.idConcepto, linea.monto]))
  const montosAnteriores = new Map(lineasAnteriores.map((linea) => [linea.idConcepto, linea.monto]))
  return {
    datos: {
      contrato,
      periodo,
      pago,
      cobro,
      conceptos: catalogo.map((concepto) => ({
        ...concepto,
        montoPago: montosPago.get(concepto.id) ?? 0,
        activoAnterior: montosAnteriores.has(concepto.id),
        montoAnterior: montosAnteriores.get(concepto.id) ?? 0,
      })),
    },
  }
}

async function guardarConceptos(conexion, idInmobiliaria, idCobro, lineas) {
  await conexion.execute(`DELETE FROM cobrosConceptos WHERE idInmobiliaria = ? AND idCobro = ?`, [idInmobiliaria, idCobro])
  for (const linea of lineas) {
    await conexion.execute(
      `INSERT INTO cobrosConceptos (idInmobiliaria, idCobro, idConcepto, conceptoTenantClave, monto) VALUES (?, ?, ?, ?, ?)`,
      [idInmobiliaria, idCobro, linea.idConcepto, linea.tenantClave, linea.monto]
    )
  }
}

async function bloquearCobro(conexion, usuario, id) {
  const { condiciones, parametros } = alcance(usuario)
  const [filas] = await conexion.execute(
    `SELECT co.id, ec.nombre AS estado, co.rutaArchivo
     FROM cobros co
     INNER JOIN estadosCobros ec
       ON ec.id = co.idEstado
     WHERE ${condiciones.join(" AND ")}
       AND co.id = ?
     FOR UPDATE`,
    [...parametros, id]
  )
  return filas[0] || null
}

const montosInvalidos = (montos) => redondear(montos.comision + montos.descuentos) > montos.montoBruto
const ERROR_MONTOS = {
  error: "DATOS_INVALIDOS",
  detalles: [{ campo: "comision", problema: "La comisión y los descuentos superan el monto a pagar" }],
}

async function avisarCobro(conexion, usuario, cobro, titulo) {
  const [propietarios] = await conexion.execute(
    "SELECT idPersona FROM propietarios WHERE idInmobiliaria = ? AND id = ?",
    [usuario.idInmobi, cobro.idPropietario]
  )
  await guardar(conexion, {
    idInmobiliaria: usuario.idInmobi,
    tipo: "Pago",
    titulo,
    contenido: `${cobro.propiedad}. Período ${cobro.periodo.split("-").reverse().join("/")}.`,
    idsPersonas: propietarios.map(({ idPersona }) => idPersona),
  })
}

async function crear(usuario, cuerpo) {
  const conexion = await db.getConnection()
  try {
    await conexion.beginTransaction()
    const [filasPago] = await conexion.execute(
      `SELECT p.id, p.idContrato, ep.nombre AS estado
       FROM pagos p
       INNER JOIN estadosPagos ep
         ON ep.id = p.idEstado
       WHERE p.idInmobiliaria = ?
         AND p.id = ?
       FOR UPDATE`,
      [usuario.idInmobi, cuerpo.idPago]
    )
    const pago = filasPago[0]
    if (!pago) {
      await conexion.rollback()
      return { error: "NO_ENCONTRADO", mensaje: "El pago no existe" }
    }
    if (pago.estado !== "Aprobado") {
      await conexion.rollback()
      return { error: "CONFLICTO", mensaje: "El pago del inquilino todavía no fue aprobado" }
    }
    if (!(await esPropietarioDelContrato(conexion, usuario.idInmobi, cuerpo.idPropietario, pago.idContrato))) {
      await conexion.rollback()
      return { error: "NO_ENCONTRADO", mensaje: "El propietario no es parte del contrato" }
    }

    const [existentes] = await conexion.execute(
      `SELECT co.id FROM cobros co WHERE co.idInmobiliaria = ? AND co.idPago = ? AND co.idPropietario = ?`,
      [usuario.idInmobi, cuerpo.idPago, cuerpo.idPropietario]
    )
    if (existentes.length) {
      await conexion.rollback()
      return { error: "CONFLICTO", mensaje: "El propietario ya tiene la liquidación de ese pago" }
    }

    const lineas = await pagos.validarConceptos(conexion, usuario.idInmobi, cuerpo.conceptos)
    if (!lineas) {
      await conexion.rollback()
      return { error: "NO_ENCONTRADO", mensaje: "Algún concepto no existe" }
    }
    const montos = calcular(cuerpo)
    if (montosInvalidos(montos)) {
      await conexion.rollback()
      return ERROR_MONTOS
    }

    const estados = await idsDeEstados(conexion)
    const [resultado] = await conexion.execute(
      `INSERT INTO cobros (idInmobiliaria, idPago, idPropietario, idEstado, montoBruto, comision, descuentos, porcentajeComision, detalle)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        usuario.idInmobi, cuerpo.idPago, cuerpo.idPropietario, estados.Pendiente, montos.montoBruto,
        montos.comision, montos.descuentos, montos.porcentajeComision, cuerpo.detalle ?? null,
      ]
    )
    await guardarConceptos(conexion, usuario.idInmobi, resultado.insertId, lineas)
    const cobro = await buscarPorId(usuario, resultado.insertId, conexion)
    await avisarCobro(conexion, usuario, cobro, "Nueva liquidación de alquiler")
    await conexion.commit()
    return { cobro }
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
    const cobro = await bloquearCobro(conexion, usuario, id)
    if (!cobro) {
      await conexion.rollback()
      return { error: "NO_ENCONTRADO", mensaje: "La liquidación no existe" }
    }
    if (cobro.estado !== "Pendiente") {
      await conexion.rollback()
      return { error: "CONFLICTO", mensaje: "Solo se puede modificar una liquidación pendiente" }
    }

    const lineas = await pagos.validarConceptos(conexion, usuario.idInmobi, cuerpo.conceptos)
    if (!lineas) {
      await conexion.rollback()
      return { error: "NO_ENCONTRADO", mensaje: "Algún concepto no existe" }
    }
    const montos = calcular(cuerpo)
    if (montosInvalidos(montos)) {
      await conexion.rollback()
      return ERROR_MONTOS
    }

    await conexion.execute(
      `UPDATE cobros
       SET montoBruto = ?, comision = ?, descuentos = ?, porcentajeComision = ?, detalle = ?
       WHERE idInmobiliaria = ? AND id = ?`,
      [montos.montoBruto, montos.comision, montos.descuentos, montos.porcentajeComision, cuerpo.detalle ?? null, usuario.idInmobi, id]
    )
    await guardarConceptos(conexion, usuario.idInmobi, id, lineas)
    const respuesta = { cobro: await buscarPorId(usuario, id, conexion) }
    await conexion.commit()
    return respuesta
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}

async function cargarComprobante(usuario, id, archivo) {
  const conexion = await db.getConnection()
  let resultado
  try {
    await conexion.beginTransaction()
    const cobro = await bloquearCobro(conexion, usuario, id)
    if (!cobro) {
      await conexion.rollback()
      return { error: "NO_ENCONTRADO", mensaje: "La liquidación no existe" }
    }
    if (cobro.estado !== "Pendiente") {
      await conexion.rollback()
      return { error: "CONFLICTO", mensaje: "Solo se puede cargar el comprobante de una liquidación pendiente" }
    }

    await conexion.execute(
      `UPDATE cobros SET nombreArchivo = ?, rutaArchivo = ?, fechaComprobante = CURRENT_TIMESTAMP WHERE idInmobiliaria = ? AND id = ?`,
      [archivo.nombreArchivo, archivo.rutaArchivo, usuario.idInmobi, id]
    )
    resultado = { cobro: await buscarPorId(usuario, id, conexion), reemplazado: cobro.rutaArchivo }
    await conexion.commit()
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }

  if (resultado.reemplazado) {
    await limpiar([{ destino: CARPETA, nombre: resultado.reemplazado, privado: true }])
  }
  return resultado
}

async function marcarPagado(usuario, id) {
  const conexion = await db.getConnection()
  try {
    await conexion.beginTransaction()
    const cobro = await bloquearCobro(conexion, usuario, id)
    if (!cobro) {
      await conexion.rollback()
      return { error: "NO_ENCONTRADO", mensaje: "La liquidación no existe" }
    }
    if (cobro.estado !== "Pendiente") {
      await conexion.rollback()
      return { error: "CONFLICTO", mensaje: `La liquidación ya está ${cobro.estado.toLowerCase()}` }
    }

    const estados = await idsDeEstados(conexion)
    await conexion.execute(
      `UPDATE cobros SET idEstado = ?, fechaCobro = CURRENT_TIMESTAMP WHERE idInmobiliaria = ? AND id = ?`,
      [estados.Liquidado, usuario.idInmobi, id]
    )
    const actualizado = await buscarPorId(usuario, id, conexion)
    await avisarCobro(conexion, usuario, actualizado, "Liquidación pagada")
    await conexion.commit()
    return { cobro: actualizado }
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }
}

async function eliminar(usuario, id) {
  const conexion = await db.getConnection()
  let resultado
  try {
    await conexion.beginTransaction()
    const cobro = await bloquearCobro(conexion, usuario, id)
    if (!cobro) {
      await conexion.rollback()
      return { error: "NO_ENCONTRADO", mensaje: "La liquidación no existe" }
    }
    if (cobro.estado === "Liquidado") {
      await conexion.rollback()
      return { error: "CONFLICTO", mensaje: "Una liquidación pagada no puede eliminarse" }
    }

    const [documentos] = await conexion.execute(
      `SELECT COUNT(*) AS total FROM documentos d WHERE d.idInmobiliaria = ? AND d.idCobro = ?`,
      [usuario.idInmobi, id]
    )
    if (Number(documentos[0].total)) {
      await conexion.rollback()
      return { error: "CONFLICTO", mensaje: "La liquidación tiene documentos vinculados" }
    }

    await conexion.execute(`DELETE FROM cobrosConceptos WHERE idInmobiliaria = ? AND idCobro = ?`, [usuario.idInmobi, id])
    await conexion.execute(`DELETE FROM cobros WHERE idInmobiliaria = ? AND id = ?`, [usuario.idInmobi, id])
    resultado = { cobro: { id }, reemplazado: cobro.rutaArchivo }
    await conexion.commit()
  } catch (error) {
    await conexion.rollback()
    throw error
  } finally {
    conexion.release()
  }

  if (resultado.reemplazado) {
    await limpiar([{ destino: CARPETA, nombre: resultado.reemplazado, privado: true }])
  }
  return resultado
}

async function comprobanteParaDescargar(usuario, id) {
  const { condiciones, parametros } = alcance(usuario)
  const [filas] = await db.execute(
    `SELECT co.nombreArchivo, co.rutaArchivo
     FROM cobros co
     WHERE ${condiciones.join(" AND ")}
       AND co.id = ?
       AND co.rutaArchivo IS NOT NULL`,
    [...parametros, id]
  )
  return filas[0] || null
}

module.exports = {
  listarPropietarios,
  listar,
  buscarPorId,
  solicitarRevision,
  preparar,
  crear,
  modificar,
  cargarComprobante,
  marcarPagado,
  eliminar,
  comprobanteParaDescargar,
}
