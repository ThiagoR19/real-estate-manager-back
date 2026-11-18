const test = require("node:test")
const assert = require("node:assert/strict")

for (const variable of ["DB_HOST", "DB_USER", "DB_NAME", "TOKEN_SECRET", "FRONT_URL", "PORT"]) {
  process.env[variable] ||= "test"
}

const db = require("../db/conexion")
const propietarios = require("../api/propietarios/propietarios.service")

test("el resumen cuenta liquidaciones y propietarios de la inmobiliaria", async (t) => {
  const consultas = []
  t.mock.method(db, "execute", async (sql, parametros) => {
    consultas.push({ sql, parametros })
    if (sql.includes("FROM propietarios pr WHERE")) return [[{ id: 2 }, { id: 4 }]]
    if (sql.includes("FROM cobros co")) return [[
      { estado: "Pendiente", id: 2, cantidad: 2 },
      { estado: "Pendiente", id: 4, cantidad: 1 },
      { estado: "Liquidado", id: 2, cantidad: 3 },
    ]]
    if (sql.includes("FROM pagos p")) return [[{ id: 4, cantidad: 2 }]]
    throw new Error("Consulta inesperada")
  })

  const resultado = await propietarios.resumen({ rol: 2, idInmobi: 7 })

  assert.deepEqual(resultado, {
    cobrosPendientes: { total: 3, ids: [2, 4] },
    liquidacionesPorGenerar: { total: 2, ids: [4] },
    propietariosActivos: { total: 2, ids: [2, 4] },
    cobrosAcreditados: { total: 3, ids: [2] },
  })
  assert.equal(consultas.length, 3)
  assert.ok(consultas.every(({ parametros }) => parametros.length === 1 && parametros[0] === 7))
  assert.match(consultas[2].sql, /ep\.nombre = 'Aprobado'/)
  assert.match(consultas[2].sql, /co\.id IS NULL/)
})
