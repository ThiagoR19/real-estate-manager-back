const test = require("node:test")
const assert = require("node:assert/strict")

for (const variable of ["DB_HOST", "DB_USER", "DB_NAME", "TOKEN_SECRET", "FRONT_URL", "PORT"]) {
  process.env[variable] ||= "test"
}

const db = require("../db/conexion")
const agentes = require("../api/agentes/agentes.service")
const admins = require("../api/admins/admins.service")

test("la baja de agentes y admins conserva cuentas con documentos asociados", async () => {
  const original = db.getConnection
  try {
    for (const [nombre, eliminar] of [
      ["agente", () => agentes.eliminar({ rol: 1 }, 7)],
      ["admin", () => admins.eliminar(8)],
    ]) {
      const consultas = []
      let reversiones = 0
      db.getConnection = async () => ({
        async beginTransaction() {},
        async rollback() { reversiones++ },
        release() {},
        async execute(sql) {
          consultas.push(sql)
          if (sql.includes("FROM documentos")) return [[{ existe: 1 }]]
          return [[{ id: 8, idUsuario: 8, idPersona: 12, idInmobiliaria: 3 }]]
        },
      })

      await assert.rejects(eliminar(), { codigo: "CONFLICTO" }, nombre)
      assert.equal(reversiones, 1, nombre)
      assert.equal(consultas.some((sql) => sql.includes("DELETE FROM usuarios")), false, nombre)
      assert.equal(consultas.some((sql) => sql.includes("UPDATE conversaciones")), false, nombre)
    }
  } finally {
    db.getConnection = original
  }
})
