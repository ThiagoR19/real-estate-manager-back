const test = require("node:test")
const assert = require("node:assert/strict")

for (const variable of ["DB_HOST", "DB_USER", "DB_NAME", "TOKEN_SECRET", "FRONT_URL", "PORT"]) {
  process.env[variable] ||= "test"
}

const db = require("../db/conexion")
const inquilinos = require("../api/inquilinos/inquilinos.service")

async function conConexionSimulada(consultar, trabajo) {
  const original = db.getConnection
  const acciones = []
  db.getConnection = async () => ({
    async beginTransaction() { acciones.push("BEGIN") },
    async commit() { acciones.push("COMMIT") },
    async rollback() { acciones.push("ROLLBACK") },
    release() { acciones.push("RELEASE") },
    async execute(sql, params) {
      acciones.push(sql)
      if (sql.includes("FROM inquilinos i")) {
        return [[{ id: 10, idInmobiliaria: 2, idPersona: 20, idUsuario: 30, fotoPerfil: null }]]
      }
      return consultar(sql, params)
    },
  })
  try {
    await trabajo(acciones)
  } finally {
    db.getConnection = original
  }
}

test("la baja conserva contratos, pagos, reportes y documentos vinculados a la persona", async () => {
  await conConexionSimulada(async (sql, params) => {
    if (sql.startsWith("DELETE FROM personas")) {
      throw Object.assign(new Error("La persona tiene historial"), { code: "ER_ROW_IS_REFERENCED_2" })
    }
    if (sql.startsWith("UPDATE versionesDocumentos")) assert.deepEqual(params, [30, 2])
    return [{ affectedRows: 1 }]
  }, async (acciones) => {
    assert.equal(await inquilinos.eliminar({ idInmobi: 2 }, 10), true)
    assert(acciones.includes("ROLLBACK TO SAVEPOINT inquilino_eliminado"))
    assert(acciones.includes("COMMIT"))
    assert(!acciones.includes("ROLLBACK"))
    assert(acciones.some((sql) => sql.startsWith("DELETE FROM inquilinos")))
    assert(acciones.some((sql) => sql.startsWith("DELETE FROM usuarios")))
    assert(!acciones.some((sql) => /DELETE FROM (documentos|versionesDocumentos|contratos|pagos|reportes)/.test(sql)))
  })
})

test("la baja elimina la persona cuando no tiene historial relacionado", async () => {
  await conConexionSimulada(async () => [{ affectedRows: 1 }], async (acciones) => {
    assert.equal(await inquilinos.eliminar({ idInmobi: 2 }, 10), true)
    assert(acciones.some((sql) => sql.startsWith("DELETE FROM personas")))
    assert(acciones.includes("COMMIT"))
  })
})

test("un error distinto de una referencia revierte toda la baja", async () => {
  await conConexionSimulada(async (sql) => {
    if (sql.startsWith("DELETE FROM personas")) {
      throw Object.assign(new Error("Error de base"), { code: "ER_LOCK_DEADLOCK" })
    }
    return [{ affectedRows: 1 }]
  }, async (acciones) => {
    await assert.rejects(inquilinos.eliminar({ idInmobi: 2 }, 10), { code: "ER_LOCK_DEADLOCK" })
    assert(acciones.includes("ROLLBACK"))
    assert(!acciones.includes("COMMIT"))
  })
})
