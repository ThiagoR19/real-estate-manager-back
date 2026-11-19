const test = require("node:test")
const assert = require("node:assert/strict")

const db = {
  async execute(sql) {
    if (sql.includes("FROM usuarios")) return [[{ idPersona: 20 }]]
    if (sql.includes("FROM inquilinos i")) return [[{ idPropiedad: 7 }]]
    if (sql.includes("FROM clientes c")) return [[{ idPersona: 20 }]]
    if (sql.includes("FROM propiedades p")) return [[{ id: 7 }]]
    if (sql.includes("FROM agentes a")) return [[{ id: 3 }]]
    if (sql.includes("FROM estadosVisitas") || sql.includes("FROM estadosReportes")) return [[{ id: 1 }]]
    throw new Error(`Consulta inesperada fuera de la transacción: ${sql}`)
  },
}
const dbPath = require.resolve("../db/conexion")
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: db }

const adjuntos = require("../utils/adjuntos")
let archivosEliminados = []
adjuntos.limpiar = async (archivos) => { archivosEliminados.push(...archivos) }

const pagos = require("../api/pagos/pagos.service")
const cobros = require("../api/cobros/cobros.service")
const visitas = require("../api/visitas/visitas.service")
const reportes = require("../api/reportes/reportes.service")
const usuario = { id: 8, idInmobi: 2, rol: 2 }
const archivo = { nombreArchivo: "nuevo.pdf", rutaArchivo: "nuevo.pdf" }

function conectar(consultar, confirmar = async () => {}) {
  const acciones = []
  let liberada = false
  archivosEliminados = []
  db.getConnection = async () => ({
    async beginTransaction() { acciones.push("begin") },
    async execute(sql, parametros) {
      assert.equal(liberada, false, "No se puede consultar tras liberar la conexión")
      acciones.push(sql)
      return consultar(sql, parametros)
    },
    async commit() { await confirmar(); acciones.push("commit") },
    async rollback() { acciones.push("rollback") },
    release() { acciones.push("release"); liberada = true },
  })
  return acciones
}

const operaciones = [
  ["crear pago", () => pagos.crear(usuario, { idContrato: 1, periodo: "2026-11" })],
  ["modificar pago", () => pagos.modificar(usuario, 1, {})],
  ["eliminar pago", () => pagos.eliminar(usuario, 1)],
  ["cargar comprobante de pago", () => pagos.cargarComprobante(usuario, 1, archivo)],
  ["marcar pago", () => pagos.marcarPagado(usuario, 1, {})],
  ["aprobar pago", () => pagos.aprobar(usuario, 1, {})],
  ["rechazar pago", () => pagos.rechazar(usuario, 1, { motivo: "Importe incorrecto" })],
  ["crear cobro", () => cobros.crear(usuario, { idPago: 1 })],
  ["modificar cobro", () => cobros.modificar(usuario, 1, {})],
  ["cargar comprobante de cobro", () => cobros.cargarComprobante(usuario, 1, archivo)],
  ["marcar cobro", () => cobros.marcarPagado(usuario, 1)],
  ["eliminar cobro", () => cobros.eliminar(usuario, 1)],
  ["modificar visita", () => visitas.modificar(usuario, 1, {})],
  ["cancelar visita", () => visitas.cancelar(usuario, 1, "Cancelación")],
  ["actualizar reporte", () => reportes.actualizar(usuario, 1, { idEstado: 2 })],
  ["programar visita", () => visitas.programar(usuario, {
    fecha: new Date(Date.now() + 86400000), idAgente: 3, idCliente: 4, idPropiedad: 7,
  })],
  ["crear reporte", () => reportes.crear({ ...usuario, rol: 5 }, { idPropiedad: 7, titulo: "Pérdida de agua" })],
]

test("un fallo de SQL revierte la operación y libera su conexión en los cuatro servicios", async (t) => {
  const error = new Error("Fallo de SQL")
  for (const [nombre, ejecutar] of operaciones) {
    await t.test(nombre, async () => {
      const acciones = conectar(async () => { throw error })
      await assert.rejects(ejecutar(), (causa) => causa === error)
      assert.equal(acciones[0], "begin")
      assert.deepEqual(acciones.slice(-2), ["rollback", "release"])
      assert(!acciones.includes("commit"))
      assert.deepEqual(archivosEliminados, [])
    })
  }
})

test("una entidad inexistente cierra la transacción sin modificar datos", async (t) => {
  for (const [nombre, ejecutar] of operaciones.slice(0, 15)) {
    await t.test(nombre, async () => {
      const acciones = conectar(async (sql) => sql.trimStart().startsWith("UPDATE") ? [{ affectedRows: 0 }] : [[]])
      const resultado = await ejecutar()
      const esReporte = nombre === "actualizar reporte"
      if (esReporte) assert.equal(resultado, null)
      else assert.equal(resultado.error, "NO_ENCONTRADO")
      assert.deepEqual(acciones.slice(-2), [esReporte ? "commit" : "rollback", "release"])
      assert.deepEqual(archivosEliminados, [])
    })
  }
})

test("la eliminación de un pago confirma ambos borrados o revierte el fallo del segundo", async () => {
  for (const fallar of [false, true]) {
    const error = new Error("No se pudo borrar el pago")
    const acciones = conectar(async (sql) => {
      if (sql.includes("FOR UPDATE")) return [[{ id: 1, estado: "Pendiente" }]]
      if (sql.includes("AS total")) return [[{ total: 0 }]]
      if (sql.startsWith("DELETE FROM pagosConceptos")) return [{ affectedRows: 2 }]
      if (sql.startsWith("DELETE FROM pagos")) {
        if (fallar) throw error
        return [{ affectedRows: 1 }]
      }
      throw new Error(`Consulta inesperada: ${sql}`)
    })
    if (fallar) await assert.rejects(pagos.eliminar(usuario, 1), (causa) => causa === error)
    else assert.deepEqual(await pagos.eliminar(usuario, 1), { pago: { id: 1 } })
    assert.deepEqual(acciones.slice(-2), [fallar ? "rollback" : "commit", "release"])
    assert(acciones.find((sql) => sql.startsWith("DELETE FROM pagosConceptos")))
    assert(acciones.find((sql) => sql.startsWith("DELETE FROM pagos WHERE")))
  }
})

test("un comprobante reemplazado se conserva si falla la confirmación del cobro", async () => {
  for (const fallar of [true, false]) {
    const error = new Error("No se pudo confirmar")
    const acciones = conectar(async (sql) => {
      if (sql.includes("FOR UPDATE")) return [[{ id: 1, estado: "Pendiente", rutaArchivo: "anterior.pdf" }]]
      if (sql.startsWith("UPDATE cobros")) return [{ affectedRows: 1 }]
      if (sql.includes("FROM cobros co")) return [[{
        id: 1, periodo: new Date("2026-11-01T00:00:00Z"), montoBruto: 100, comision: 10,
        descuentos: 0, porcentajeComision: 10, montoNeto: 90, nombreArchivo: "nuevo.pdf",
      }]]
      if (sql.includes("FROM cobrosConceptos")) return [[]]
      throw new Error(`Consulta inesperada: ${sql}`)
    }, async () => {
      assert.deepEqual(archivosEliminados, [], "El archivo anterior se conserva hasta confirmar")
      if (fallar) throw error
    })
    if (fallar) {
      await assert.rejects(cobros.cargarComprobante(usuario, 1, archivo), (causa) => causa === error)
      assert.deepEqual(archivosEliminados, [])
    } else {
      const resultado = await cobros.cargarComprobante(usuario, 1, archivo)
      assert.equal(resultado.cobro.id, 1)
      assert.deepEqual(archivosEliminados, [{ destino: "comprobantes", nombre: "anterior.pdf", privado: true }])
    }
    assert.deepEqual(acciones.slice(-2), [fallar ? "rollback" : "commit", "release"])
  }
})
