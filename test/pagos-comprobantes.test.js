const test = require("node:test")
const assert = require("node:assert/strict")
const db = require("../db/conexion")
const { ADMIN, AGENTE, INQUILINO, PROPIETARIO } = require("../config/roles")
const notificaciones = require("../api/notificaciones/notificaciones.service")
const adjuntos = require("../utils/adjuntos")

notificaciones.guardar = (conexion, aviso) => conexion.registrarAviso(aviso)
adjuntos.limpiar = async (archivos) => archivosEliminados.push(...archivos)

const pagos = require("../api/pagos/pagos.service")
const cobros = require("../api/cobros/cobros.service")
const { aprobarPagoSchema, rechazarPagoSchema, marcarPagadoSchema } = require("../api/pagos/pagos.schema")
const inquilino = { id: 8, idInmobi: 2, rol: INQUILINO }
const propietario = { id: 9, idInmobi: 2, rol: PROPIETARIO }
const archivo = { nombreArchivo: "transferencia.pdf", rutaArchivo: "nuevo.pdf" }
const periodo = new Date("2026-11-01T00:00:00Z")
const pago = { id: 7, idPersona: 20, propiedad: "Bielke", idAgente: 3, periodo, monto: "100.00", moneda: "USD" }
let archivosEliminados = []

function simularTransaccion(t, consultar, { fallaAviso } = {}) {
  const acciones = []
  const avisos = []
  archivosEliminados = []
  t.mock.method(db, "getConnection", async () => ({
    async beginTransaction() { acciones.push("begin") },
    async execute(sql, parametros) {
      acciones.push(sql)
      return consultar(sql, parametros)
    },
    async registrarAviso(aviso) {
      acciones.push("aviso")
      if (fallaAviso) throw fallaAviso
      avisos.push(aviso)
      return { idsUsuarios: [13], notificacion: { id: 29 } }
    },
    async commit() { acciones.push("commit") },
    async rollback() { acciones.push("rollback") },
    release() { acciones.push("release") },
  }))
  return { acciones, avisos }
}

function consultasCarga(sql, parametros) {
  if (sql.includes("FOR UPDATE")) {
    assert.match(sql, /tpa\.nombre = 'Inquilino'/)
    assert.deepEqual(parametros, [2, 8, 7])
    return [[{ id: 7, estado: "Rechazado" }]]
  }
  if (sql.startsWith("SELECT co.rutaArchivo")) return [[{ rutaArchivo: "anterior.pdf" }]]
  if (sql.startsWith("DELETE FROM comprobantes")) {
    assert.match(sql, /estado = 'PENDIENTE'/)
    return [{ affectedRows: 1 }]
  }
  if (sql.includes("SELECT u.idPersona")) return [[{ idPersona: 20 }]]
  if (sql.startsWith("INSERT INTO comprobantes")) {
    assert.deepEqual(parametros, [2, 7, 20, "transferencia.pdf", "nuevo.pdf"])
    return [{ insertId: 30 }]
  }
  if (sql.includes("SELECT id, nombre FROM estadosPagos")) return [[{ id: 2, nombre: "En revision" }]]
  if (sql.startsWith("UPDATE pagos")) {
    assert.equal(parametros[0], 2)
    return [{ affectedRows: 1 }]
  }
  if (sql.includes("AS tieneComprobante")) {
    assert.match(sql, /c\.moneda/)
    return [[{ ...pago, estado: "En revision", tieneComprobante: 1 }]]
  }
  if (sql.includes("FROM pagosConceptos")) return [[]]
  if (sql.includes("FROM comprobantes co")) return [[{ id: 30, nombreArchivo: "transferencia.pdf", estado: "PENDIENTE" }]]
  if (sql.includes("AS fechaLiquidacion")) return [[{ fechaLiquidacion: null }]]
  throw new Error(`Consulta inesperada: ${sql}`)
}

test("enviar comprobante guarda el archivo, actualiza el pago y avisa al personal en una transacción", async (t) => {
  const { acciones, avisos } = simularTransaccion(t, consultasCarga)
  const resultado = await pagos.cargarComprobante(inquilino, 7, archivo, { enviar: true })

  assert.equal(resultado.pago.estado, "En revision")
  assert.equal(resultado.pago.moneda, "USD")
  assert.equal(resultado.pago.comprobantes[0].nombreArchivo, archivo.nombreArchivo)
  assert.deepEqual(avisos.map(({ idAgente, roles, excluirUsuario }) => ({ idAgente, roles, excluirUsuario })), [
    { idAgente: 3, roles: [ADMIN], excluirUsuario: inquilino.id },
  ])
  const insertar = acciones.findIndex((sql) => sql.startsWith("INSERT INTO comprobantes"))
  const actualizar = acciones.findIndex((sql) => sql.startsWith("UPDATE pagos"))
  assert(insertar > 0 && insertar < actualizar && actualizar < acciones.indexOf("aviso"))
  assert.deepEqual(acciones.slice(-3), ["aviso", "commit", "release"])
  assert.deepEqual(archivosEliminados, [{ destino: "comprobantes", nombre: "anterior.pdf", privado: true }])
})

const alta = { idContrato: 15, periodo: "2025-03" }
const contrato = {
  id: alta.idContrato,
  idPropiedad: 4,
  idPersona: 20,
  propiedad: "Bielke",
  moneda: "USD",
  montoAcordado: "300.00",
  periodicidadPago: "MENSUAL",
  fechaInicio: new Date("2025-01-23T00:00:00Z"),
  fechaFin: new Date("2025-03-12T00:00:00Z"),
}
const ajuste = { idContrato: alta.idContrato, fechaAplicacion: new Date("2025-02-15T00:00:00Z"), montoNuevo: "410.25" }

function verificarConsultaContrato(sql, parametros, idContrato) {
  assert.match(sql, /tp\.nombre = 'Inquilino'/)
  assert.match(sql, /u\.idPersona = cp\.idPersona AND u\.idInmobiliaria = cp\.idInmobiliaria/)
  assert.match(sql, /LEAST\(COALESCE\(c\.fechaFin, c\.fechaRescision\)/)
  assert.deepEqual(parametros, [2, 8, "Borrador", "Anulado", ...(idContrato ? [idContrato] : [])])
}

test("lista períodos propios sin pago previo con los importes vigentes y descarta contratos únicos ya pagados", async (t) => {
  const contratoUnico = { ...contrato, id: 16, periodicidadPago: "UNICO" }
  const otroUnico = { ...contratoUnico, id: 17 }
  t.mock.method(db, "execute", async (sql, parametros) => {
    if (sql.includes("FROM contratos c")) {
      verificarConsultaContrato(sql, parametros)
      return [[contrato, contratoUnico, otroUnico]]
    }
    assert.deepEqual(parametros, [2, 15, 16, 17])
    if (sql.includes("FROM pagos")) {
      return [[
        { idContrato: 15, periodo: new Date("2025-02-01T00:00:00Z") },
        { idContrato: 16, periodo: new Date("2025-02-01T00:00:00Z") },
      ]]
    }
    if (sql.includes("FROM ajustesAlquiler")) return [[ajuste]]
    throw new Error(`Consulta inesperada: ${sql}`)
  })

  assert.deepEqual(await pagos.listarContratosDisponibles(inquilino), {
    contratos: [
      { idContrato: 15, idPropiedad: 4, propiedad: "Bielke", moneda: "USD", periodos: [
        { periodo: "2025-03", monto: 410.25 }, { periodo: "2025-01", monto: 300 },
      ] },
      { idContrato: 17, idPropiedad: 4, propiedad: "Bielke", moneda: "USD", periodos: [{ periodo: "2025-01", monto: 300 }] },
    ],
  })
})

function consultasAlta(sql, parametros) {
  if (sql.includes("AND c.id = ? FOR UPDATE")) {
    verificarConsultaContrato(sql, parametros, alta.idContrato)
    return [[contrato]]
  }
  if (sql.startsWith("SELECT id FROM pagos")) {
    assert.match(sql, /AND periodo = \? LIMIT 1 FOR UPDATE/)
    assert.deepEqual(parametros, [2, alta.idContrato, "2025-03-01"])
    return [[]]
  }
  if (sql.includes("FROM ajustesAlquiler")) return [[ajuste]]
  if (sql.includes("FROM conceptosPago")) {
    assert.deepEqual(parametros, ["Alquiler mensual", 2])
    return [[]]
  }
  if (sql.startsWith("INSERT INTO conceptosPago")) {
    assert.match(sql, /ON DUPLICATE KEY UPDATE/)
    assert.deepEqual(parametros, [2, "Alquiler mensual"])
    return [{ insertId: 19 }]
  }
  if (sql.includes("SELECT id, nombre FROM estadosPagos")) {
    return [[{ id: 1, nombre: "Pendiente" }, { id: 2, nombre: "En revision" }]]
  }
  if (sql.startsWith("INSERT INTO pagos (")) {
    assert.deepEqual(parametros.slice(0, 6), [2, alta.idContrato, 20, 1, "2025-03-01", 410.25])
    assert.equal(parametros[6].toISOString(), "2025-03-10T03:00:00.000Z")
    return [{ insertId: 7 }]
  }
  if (sql.startsWith("INSERT INTO pagosConceptos")) {
    assert.deepEqual(parametros, [2, 19, 2, 7, 410.25])
    return [{ affectedRows: 1 }]
  }
  if (sql.startsWith("INSERT INTO comprobantes")) {
    assert.deepEqual(parametros, [2, 7, 20, archivo.nombreArchivo, archivo.rutaArchivo])
    return [{ insertId: 30 }]
  }
  if (sql.startsWith("UPDATE pagos")) return [{ affectedRows: 1 }]
  if (sql.includes("AS tieneComprobante")) {
    return [[{ ...pago, idContrato: alta.idContrato, periodo: new Date("2025-03-01T00:00:00Z"), estado: "En revision", monto: "410.25", tieneComprobante: 1 }]]
  }
  if (sql.includes("FROM pagosConceptos")) return [[{ idConcepto: 19, nombre: "Alquiler mensual", monto: "410.25" }]]
  if (sql.includes("FROM comprobantes co")) return [[{ id: 30, estado: "PENDIENTE" }]]
  if (sql.includes("AS fechaLiquidacion")) return [[{ fechaLiquidacion: null }]]
  throw new Error(`Consulta inesperada: ${sql}`)
}

test("el inquilino registra su primer pago con comprobante e importe contractual en una transacción", async (t) => {
  const { acciones, avisos } = simularTransaccion(t, consultasAlta)
  const resultado = await pagos.registrarConComprobante(inquilino, alta, archivo)

  assert.equal(resultado.pago.estado, "En revision")
  assert.equal(resultado.pago.monto, 410.25)
  assert.equal(resultado.pago.comprobantes[0].id, 30)
  assert.equal(avisos[0].titulo, "Pago pendiente de revisión")
  assert.deepEqual(acciones.slice(-3), ["aviso", "commit", "release"])
})

test("revierte el alta completa si falla el comprobante", async (t) => {
  const fallo = new Error("Error al insertar comprobante")
  const { acciones } = simularTransaccion(t, (sql, parametros) => {
    if (sql.startsWith("INSERT INTO comprobantes")) throw fallo
    return consultasAlta(sql, parametros)
  })
  await assert.rejects(pagos.registrarConComprobante(inquilino, alta, archivo), fallo)
  assert.deepEqual(acciones.slice(-2), ["rollback", "release"])
  assert(!acciones.includes("aviso"))
})

test("el alta rechaza contratos ajenos, períodos fuera del contrato y pagos duplicados", async (t) => {
  for (const caso of [
    { nombre: "contrato ajeno", filas: [], solicitud: alta, error: "NO_ENCONTRADO" },
    { nombre: "período posterior", filas: [contrato], solicitud: { ...alta, periodo: "2025-04" }, error: "DATOS_INVALIDOS" },
    { nombre: "período duplicado", filas: [contrato], solicitud: alta, error: "CONFLICTO" },
  ]) {
    await t.test(caso.nombre, async (subtest) => {
      const { acciones } = simularTransaccion(subtest, (sql, parametros) => {
        if (sql.includes("AND c.id = ? FOR UPDATE")) {
          verificarConsultaContrato(sql, parametros, alta.idContrato)
          return [caso.filas]
        }
        if (sql.startsWith("SELECT id FROM pagos") && caso.error === "CONFLICTO") return [[{ id: 7 }]]
        throw new Error(`Consulta inesperada: ${sql}`)
      })
      assert.equal((await pagos.registrarConComprobante(inquilino, caso.solicitud, archivo)).error, caso.error)
      assert.deepEqual(acciones.slice(-2), ["rollback", "release"])
    })
  }
})

test("un error al registrar el aviso revierte el envío y conserva el archivo anterior", async (t) => {
  const fallaAviso = new Error("No se pudo guardar el aviso")
  const { acciones } = simularTransaccion(t, consultasCarga, { fallaAviso })
  await assert.rejects(pagos.cargarComprobante(inquilino, 7, archivo, { enviar: true }), fallaAviso)
  assert.deepEqual(acciones.slice(-3), ["aviso", "rollback", "release"])
  assert.deepEqual(archivosEliminados, [])
})

test("enviar un pago previo como transferencia exige un comprobante pendiente", async (t) => {
  const { acciones } = simularTransaccion(t, (sql) => {
    if (sql.includes("FOR UPDATE")) return [[{ id: 7, estado: "Rechazado" }]]
    if (sql.startsWith("SELECT 1 FROM comprobantes")) return [[]]
    throw new Error(`Consulta inesperada: ${sql}`)
  })
  const resultado = await pagos.marcarPagado(inquilino, 7, { medioPago: "TRANSFERENCIA" })
  assert.equal(resultado.error, "CONFLICTO")
  assert.deepEqual(acciones.slice(-2), ["rollback", "release"])
  assert(!acciones.some((sql) => sql.startsWith("UPDATE")))
})

test("el agente actualiza el pago y el comprobante al resolver un envío", async (t) => {
  for (const { etiqueta, estadoPrevio, estado, estadoArchivo, idComprobante, resolver } of [
    {
      etiqueta: "aprobar el comprobante", estadoPrevio: "En revision", estado: "Aprobado",
      estadoArchivo: "APROBADO", idComprobante: 30, resolver: pagos.aprobar,
    },
    {
      etiqueta: "rechazar el comprobante", estadoPrevio: "En revision", estado: "Rechazado",
      estadoArchivo: "RECHAZADO", idComprobante: 30, resolver: pagos.rechazar,
    },
    {
      etiqueta: "aprobar manualmente", estadoPrevio: "Pendiente", estado: "Aprobado",
      estadoArchivo: "APROBADO", idComprobante: undefined, resolver: pagos.aprobar,
    },
  ]) {
    await t.test(etiqueta, async (subtest) => {
      const agente = { id: 13, idInmobi: 2, rol: AGENTE }
      const { acciones, avisos } = simularTransaccion(subtest, (sql, parametros) => {
        if (sql.startsWith("SELECT id FROM comprobantes")) {
          assert.equal(idComprobante, 30)
          assert.match(sql, /ORDER BY fechaCarga DESC, id DESC/)
          assert.deepEqual(parametros, [2, 7])
          return [[{ id: 30 }]]
        }
        if (sql.includes("FOR UPDATE")) return [[{ id: 7, estado: estadoPrevio }]]
        if (sql.includes("SELECT id, nombre FROM estadosPagos")) return [[{ id: 4, nombre: estado }]]
        if (sql.startsWith("UPDATE pagos")) {
          assert.equal(parametros[0], 4)
          return [{ affectedRows: 1 }]
        }
        if (sql.startsWith("UPDATE comprobantes")) {
          assert(sql.includes(`estado = '${estadoArchivo}'`))
          assert(sql.includes("AND estado = 'PENDIENTE'"))
          assert.equal(parametros.at(-1), idComprobante ?? null)
          if (estadoArchivo === "RECHAZADO") assert.equal(parametros[0], "Importe incorrecto")
          return [{ affectedRows: 1 }]
        }
        if (sql.includes("AS tieneComprobante")) return [[{ ...pago, estado, tieneComprobante: 1 }]]
        if (sql.includes("FROM comprobantes co")) return [[{ estado: estadoArchivo }]]
        if (sql.includes("FROM pagosConceptos")) return [[]]
        if (sql.includes("AS fechaLiquidacion")) return [[{ fechaLiquidacion: null }]]
        if (sql.includes("SELECT u.idPersona")) return [[{ idPersona: 40 }]]
        throw new Error(`Consulta inesperada: ${sql}`)
      })

      const { pago: actualizado } = await resolver(agente, 7, { idComprobante, motivo: "Importe incorrecto" })
      assert.equal(actualizado.estado, estado)
      assert.equal(actualizado.comprobantes[0].estado, estadoArchivo)
      assert.deepEqual(avisos[0].idsPersonas, [20])
      assert.deepEqual(acciones.slice(-3), ["aviso", "commit", "release"])
    })
  }
})

test("la revisión rechaza comprobantes reemplazados o pagos que ya salieron de revisión", async (t) => {
  for (const [resolver, estado] of [[pagos.aprobar, "En revision"], [pagos.rechazar, "En revision"], [pagos.aprobar, "Rechazado"]]) {
    await t.test(`${resolver.name} · ${estado}`, async (subtest) => {
      const { acciones, avisos } = simularTransaccion(subtest, (sql) => {
        if (sql.startsWith("SELECT id FROM comprobantes") && estado === "En revision") return [[{ id: 31 }]]
        if (sql.includes("FROM pagos p") && sql.includes("FOR UPDATE")) return [[{ id: 7, estado }]]
        throw new Error(`Consulta inesperada: ${sql}`)
      })
      const resultado = await resolver({ id: 13, idInmobi: 2, rol: AGENTE }, 7, {
        idComprobante: 30,
        motivo: "Importe incorrecto",
      })
      assert.equal(resultado.error, "CONFLICTO")
      assert.deepEqual(acciones.slice(-2), ["rollback", "release"])
      assert.deepEqual(avisos, [])
    })
  }
})

test("solo las resoluciones del agente aceptan el identificador del comprobante", () => {
  assert(aprobarPagoSchema.safeParse({ idComprobante: 30 }).success)
  assert(rechazarPagoSchema.safeParse({ idComprobante: 30, motivo: "Importe incorrecto" }).success)
  assert(!aprobarPagoSchema.safeParse({ idComprobante: "30" }).success)
  assert(!marcarPagadoSchema.safeParse({ idComprobante: 30 }).success)
})

test("solicitar revisión usa el alcance del propietario y avisa con el motivo y el solicitante", async (t) => {
  t.mock.method(db, "execute", async (sql, parametros) => {
    if (sql.includes("FROM cobrosConceptos")) return [[]]
    assert.match(sql, /pra\.id = co\.idPropietario/)
    assert.match(sql, /c\.moneda/)
    assert.deepEqual(parametros, [2, 9, 10])
    return [[{ ...pago, id: 10, montoBruto: 100, montoNeto: 90 }]]
  })
  const { acciones, avisos } = simularTransaccion(t, (sql, parametros) => {
    assert.match(sql, /u\.idInmobiliaria = \? AND u\.id = \?/)
    assert.deepEqual(parametros, [2, 9])
    return [[{ nombre: "Ana", apellido: "Pérez" }]]
  })

  const resultado = await cobros.solicitarRevision(propietario, 10, "Revisar la comisión")
  assert.deepEqual(resultado.solicitud, { id: 29 })
  assert.equal(avisos[0].contenido, "Ana Pérez. Bielke. Período 11/2026. Revisar la comisión")
  assert.deepEqual(acciones.slice(-3), ["aviso", "commit", "release"])
})
