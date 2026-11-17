const test = require("node:test")
const assert = require("node:assert/strict")

for (const variable of ["DB_HOST", "DB_USER", "DB_NAME", "TOKEN_SECRET", "FRONT_URL", "PORT"]) {
  process.env[variable] ||= "test"
}

const db = require("../db/conexion")
const inquilinos = require("../api/inquilinos/inquilinos.service")
const { actualizarInquilinoSchema } = require("../api/inquilinos/inquilinos.schema")

test("el esquema acepta una propiedad válida y rechaza identificadores inválidos", () => {
  assert.equal(actualizarInquilinoSchema.parse({ idPropiedad: 7 }).idPropiedad, 7)
  assert.equal(actualizarInquilinoSchema.safeParse({ idPropiedad: 0 }).success, false)
  assert.equal(actualizarInquilinoSchema.safeParse({ idPropiedad: null }).success, false)
})

test("asignar una propiedad actualiza solo al inquilino de la inmobiliaria", async (t) => {
  const consultas = []
  let propiedadAsignada = null
  let confirmaciones = 0
  const conexion = {
    async beginTransaction() {},
    async commit() { confirmaciones++ },
    async rollback() {},
    release() {},
    async execute(sql, parametros) {
      consultas.push({ sql, parametros })
      if (sql.includes("FROM inquilinos i")) return [[{ id: 10, idPersona: 20, idPropiedad: propiedadAsignada }]]
      if (sql.startsWith("SELECT id FROM propiedades")) return [[{ id: 7 }]]
      if (sql.startsWith("UPDATE inquilinos SET idPropiedad")) {
        propiedadAsignada = parametros[0]
        return [{ affectedRows: 1 }]
      }
      throw new Error(`Consulta inesperada: ${sql}`)
    },
  }
  t.mock.method(db, "getConnection", async () => conexion)
  t.mock.method(db, "execute", async () => [[{ id: 10, idPersona: 20, idPropiedad: propiedadAsignada }]])

  const actualizado = await inquilinos.actualizar({ idInmobi: 2 }, 10, { idPropiedad: 7 })
  assert.equal(actualizado.idPropiedad, 7)
  assert.equal(confirmaciones, 1)
  assert.deepEqual(consultas.find(({ sql }) => sql.startsWith("SELECT id FROM propiedades")).parametros, [7, 2])
  assert.deepEqual(consultas.find(({ sql }) => sql.startsWith("UPDATE inquilinos SET idPropiedad")).parametros, [7, 10, 2])
  assert.equal(consultas.some(({ sql }) => sql.startsWith("UPDATE contratos")), false)
})

test("rechaza una propiedad que no pertenece a la inmobiliaria", async (t) => {
  let reversiones = 0
  let confirmaciones = 0
  const conexion = {
    async beginTransaction() {},
    async commit() { confirmaciones++ },
    async rollback() { reversiones++ },
    release() {},
    async execute(sql) {
      if (sql.includes("FROM inquilinos i")) return [[{ id: 10, idPersona: 20 }]]
      if (sql.startsWith("SELECT id FROM propiedades")) return [[]]
      throw new Error(`Consulta inesperada: ${sql}`)
    },
  }
  t.mock.method(db, "getConnection", async () => conexion)

  await assert.rejects(inquilinos.actualizar({ idInmobi: 2 }, 10, { idPropiedad: 99 }), {
    codigo: "NO_ENCONTRADO",
  })
  assert.equal(reversiones, 1)
  assert.equal(confirmaciones, 0)
})
