const test = require("node:test")
const assert = require("node:assert/strict")

const db = {}
const dbPath = require.resolve("../db/conexion")
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: db }

const chats = require("../api/chats/chats.service")
const { historialQuerySchema } = require("../api/chats/chats.schema")

const conversacion = { id: 7, idInmobiliaria: 2, idPersona: 20, noLeidos: 0 }
const mensaje = (id) => ({ id, idInmobiliaria: 2, idConversacion: 7, idPersona: 20, contenido: `Mensaje ${id}`, fecha: new Date("2026-11-15T12:00:00Z") })

test("el historial usa un cursor estable al llegar un mensaje nuevo", async () => {
  const consultas = []
  db.execute = async (sql, params) => {
    consultas.push({ sql, params })
    if (sql.includes("WHERE u.id = ? AND c.id = ?")) return [[conversacion]]
    if (sql.includes("COUNT(*) AS total FROM mensajes")) return [[{ total: 5 }]]
    if (sql.includes("WHERE m.idConversacion = ? AND m.idInmobiliaria = ?")) {
      return [params.length === 3 ? [mensaje(4), mensaje(3), mensaje(2)] : [mensaje(2), mensaje(1)]]
    }
    if (sql.includes("FROM mensajesAdjuntos a")) return [[]]
    throw new Error(`Consulta inesperada: ${sql}`)
  }
  const primera = await chats.historial(1, 7, { limit: 2 })
  assert.deepEqual(primera.items.map(({ id }) => id), [4, 3])
  assert.equal(primera.paginacion.siguienteCursor, 3)


  const segunda = await chats.historial(1, 7, { page: 2, limit: 2, before: 3 })
  assert.deepEqual(segunda.items.map(({ id }) => id), [2, 1])
  assert.equal(segunda.paginacion.hayMas, false)
  const sqlSegunda = consultas.find(({ sql, params }) => sql.includes("SELECT ancla.fecha") && params.includes(3))
  assert(sqlSegunda)
  assert(!sqlSegunda.sql.includes("OFFSET"))
  assert.equal(historialQuerySchema.safeParse({ page: "2" }).success, false)
  assert.equal(historialQuerySchema.safeParse({ page: "2", before: "3" }).success, true)
})

test("buscar solo por fecha devuelve mensajes y conversaciones", async () => {
  const consultas = []
  db.execute = async (sql, params) => {
    consultas.push({ sql, params })
    if (sql.includes("INNER JOIN mensajes m")) return [[mensaje(8)]]
    if (sql.includes("FROM mensajes mb")) return [[conversacion]]
    throw new Error(`Consulta inesperada: ${sql}`)
  }
  const resultado = await chats.buscar(1, { fecha: "2026-11-15" })
  assert.deepEqual(resultado.mensajes.map(({ id }) => id), [8])
  assert.deepEqual(resultado.conversaciones.map(({ id }) => id), [7])
  assert.deepEqual(consultas[1].params, [1, "2026-11-15", "2026-11-15"])
})

test("la lectura registra el último ID visible bajo bloqueo de conversación", async () => {
  const consultas = []
  db.execute = async (sql) => {
    if (sql.includes("WHERE u.id = ? AND c.id = ?")) return [[conversacion]]
    if (sql.includes("u.fechaActivacion")) return [[{ id: 1, idPersona: 10, idInmobiliaria: 2 }]]
    throw new Error(`Consulta inesperada: ${sql}`)
  }
  const conexion = {
    async beginTransaction() { consultas.push("begin") },
    async commit() { consultas.push("commit") },
    async rollback() { consultas.push("rollback") },
    release() { consultas.push("release") },
    async execute(sql, params) {
      consultas.push({ sql, params })
      if (sql.includes("SELECT MAX(id)")) return [[{ ultimoId: 42 }]]
      return [[]]
    },
  }
  db.getConnection = async () => conexion
  await chats.marcarLeida(1, 7)
  const bloqueo = consultas.findIndex((valor) => valor.sql?.includes("FOR UPDATE"))
  const marca = consultas.findIndex((valor) => valor.sql?.includes("INSERT INTO conversacionesEstado"))
  assert(bloqueo >= 0 && marca > bloqueo)
  assert.equal(consultas[marca].params[3], 42)
  assert(consultas.includes("commit"))
})

test("iniciar reintenta un deadlock sin crear otra conversación", async () => {
  let intentos = 0
  let rollbacks = 0
  let commits = 0
  db.execute = async (sql, params) => {
    if (sql.includes("u.fechaActivacion")) {
      return [[{ id: params[0], idPersona: params[0] === 1 ? 10 : 20, idInmobiliaria: 2, idRol: params[0] === 1 ? 2 : 5, fechaActivacion: new Date() }]]
    }
    if (sql.includes("WHERE u.id = ? AND c.id = ?")) return [[conversacion]]
    if (sql.includes("WHERE m.id = ? AND m.idInmobiliaria = ?")) return [[mensaje(6)]]
    if (sql.includes("FROM mensajesAdjuntos a")) return [[]]
    throw new Error(`Consulta inesperada: ${sql}`)
  }
  db.getConnection = async () => {
    intentos += 1
    const intento = intentos
    return {
      async beginTransaction() {},
      async rollback() { rollbacks += 1 },
      async commit() { commits += 1 },
      release() {},
      async execute(sql) {
        if (sql.includes("SELECT c.id") && sql.includes("FROM conversaciones c")) {
          assert(!sql.includes("FOR UPDATE"))
          return [intento === 1 ? [] : [{ id: 7 }]]
        }
        if (sql.includes("INSERT INTO conversaciones (")) {
          throw Object.assign(new Error("Deadlock"), { code: "ER_LOCK_DEADLOCK" })
        }
        if (sql.includes("INSERT INTO mensajes (")) return [{ insertId: 6 }]
        if (sql.includes("SELECT MAX(id)")) return [[{ ultimoId: 6 }]]
        return [[]]
      },
    }
  }
  const resultado = await chats.iniciar(1, { idUsuario: 2, mensaje: "Hola" })
  assert.equal(resultado.creada, false)
  assert.equal(resultado.mensaje.id, 6)
  assert.equal(intentos, 2)
  assert.equal(rollbacks, 1)
  assert.equal(commits, 1)
})
