const test = require("node:test")
const assert = require("node:assert/strict")

const db = { execute: async () => { throw new Error("Consulta inesperada") } }
const dbPath = require.resolve("../db/conexion")
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: db }

const reportes = require("../api/reportes/reportes.service")
const profesionales = require("../api/profesionales/profesionales.service")
const { crearReporteSchema } = require("../api/reportes/reportes.schema")

const inquilino = { id: 8, idInmobi: 2, rol: 5 }
const propietario = { id: 9, idInmobi: 2, rol: 4 }
const baseReporte = { idPropiedad: 7, idCategoria: 1, titulo: "Pérdida de agua", fecha: "2026-11-15" }

test("una fecha inexistente se rechaza antes de consultar la base", () => {
  assert.equal(crearReporteSchema.safeParse({ ...baseReporte, fecha: "2026-02-31" }).success, false)
  assert.equal(crearReporteSchema.safeParse({ ...baseReporte, fecha: "2026-02-28" }).success, true)
})

test("la lectura usa asociaciones de propiedad para propietarios y alquiler vigente para inquilinos", async () => {
  const consultas = []
  db.execute = async (sql, params) => {
    consultas.push({ sql, params })
    return sql.includes("COUNT(*)") ? [[{ total: 0 }]] : [[]]
  }
  await reportes.listar(propietario)
  assert.equal(consultas.length, 2)
  assert(consultas.every(({ sql }) => sql.includes("propiedadesPersonas") && sql.includes("tp.nombre = 'Propietario'")))
  assert(consultas.every(({ params }) => params[0] === 2 && params[1] === 9))

  consultas.length = 0
  await reportes.listar(inquilino)
  assert(consultas.every(({ sql }) => sql.includes("tc.nombre = 'Alquiler'") && sql.includes("tp.nombre = 'Inquilino'")))
  assert(consultas.every(({ sql }) => sql.includes("c.fechaInicio <= ?") && sql.includes("r.idPersonaReporta")))
  assert(consultas.every(({ params }) => params[0] === 2 && params[1] === 8 && params[2] === 8))
})

test("un inquilino no puede crear un reporte en una propiedad ajena", async () => {
  let huboInsercion = false
  db.execute = async (sql) => {
    if (sql.includes("FROM usuarios")) return [[{ idPersona: 20 }]]
    if (sql.includes("FROM contratos c")) return [[]]
    if (sql.includes("INSERT INTO reportes")) huboInsercion = true
    throw new Error(`Consulta inesperada: ${sql}`)
  }
  await assert.rejects(reportes.crear(inquilino, baseReporte), { codigo: "SIN_PERMISO" })
  assert.equal(huboInsercion, false)
})

test("un inquilino no puede crear un reporte resuelto y el estado por defecto es Abierto", async () => {
  let insercion
  let destinatarios
  db.execute = async (sql, params) => {
    if (sql.startsWith("SELECT idPersona")) return [[{ idPersona: 20 }]]
    if (sql.startsWith("SELECT 1 FROM contratos c")) return [[{ 1: 1 }]]
    if (sql.startsWith("SELECT id FROM estadosReportes")) return [[{ id: 1 }]]
    if (sql.includes("INSERT INTO reportes")) {
      insercion = params
      return [{ insertId: 15 }]
    }
    if (sql.includes("FROM reportes r")) return [[{
      id: 15, idInmobiliaria: 2, idPropiedad: 7, idAgente: 12, estado: "Abierto", titulo: baseReporte.titulo,
    }]]
    if (sql.includes("FROM reportesImagenes")) return [[]]
    if (sql.includes("FROM propiedadesPersonas pp")) return [[{ idPersona: 42 }]]
    throw new Error(`Consulta inesperada: ${sql}`)
  }
  db.getConnection = async () => conexion((sql, params) => {
    if (sql.includes("SELECT u.id, u.idPersona")) {
      assert.deepEqual(params, [2, 8, 2, 42, 12])
      return [[{ id: 30, idPersona: 42 }]]
    }
    if (sql.includes("FROM tiposNotificaciones")) return [[{ id: 3 }]]
    if (sql.includes("INSERT INTO notificaciones")) return [{ insertId: 90 }]
    if (sql.includes("INSERT INTO personasNotificaciones")) {
      destinatarios = params
      return [{ affectedRows: 1 }]
    }
    if (sql.includes("c.idPropiedad IN")) return [[]]
    return db.execute(sql, params)
  })
  await assert.rejects(reportes.crear(inquilino, { ...baseReporte, idEstado: 3 }), { codigo: "SIN_PERMISO" })
  assert.equal(insercion, undefined)
  await reportes.crear(inquilino, baseReporte)
  assert.equal(insercion[3], 1)
  assert.equal(insercion[4], 20)
  assert.deepEqual(destinatarios, [2, 90, 42])
})

function conexion(consultar) {
  const acciones = []
  return {
    acciones,
    async beginTransaction() { acciones.push("begin") },
    async commit() { acciones.push("commit") },
    async rollback() { acciones.push("rollback") },
    release() { acciones.push("release") },
    async execute(sql, params) { acciones.push(sql); return consultar(sql, params) },
  }
}

test("un profesional no puede tomar una persona ya asociada a otra entidad", async () => {
  const con = conexion(async (sql) => {
    if (sql.includes("FROM personas") && sql.includes("FOR UPDATE")) return [[{ id: 20 }]]
    if (sql.includes("AS ocupada")) return [[{ ocupada: 1 }]]
    throw new Error(`Consulta inesperada: ${sql}`)
  })
  db.getConnection = async () => con
  await assert.rejects(profesionales.crear({ idInmobi: 2 }, { idPersona: 20, profesion: "Plomería" }), { codigo: "CONFLICTO" })
  assert(con.acciones.includes("rollback"))
  assert(!con.acciones.some((sql) => sql.includes("INSERT INTO profesionales")))
})

test("la baja del profesional conserva una persona usada por otros registros", async () => {
  const con = conexion(async (sql) => {
    if (sql.includes("FROM profesionales pr")) return [[{ id: 10, idInmobiliaria: 2, idPersona: 20 }]]
    if (sql.includes("DELETE FROM personas")) throw Object.assign(new Error("Referencia existente"), { code: "ER_ROW_IS_REFERENCED_2" })
    return [{}]
  })
  db.getConnection = async () => con
  assert.equal(await profesionales.eliminar({ idInmobi: 2 }, 10), true)
  assert(con.acciones.includes("ROLLBACK TO SAVEPOINT profesional_eliminado"))
  assert(con.acciones.includes("commit"))
  assert(!con.acciones.includes("rollback"))
})
