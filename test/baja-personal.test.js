const test = require("node:test")
const assert = require("node:assert/strict")

for (const variable of ["DB_HOST", "DB_USER", "DB_NAME", "TOKEN_SECRET", "FRONT_URL", "PORT"]) {
  process.env[variable] ||= "test"
}

const db = require("../db/conexion")
const agentes = require("../api/agentes/agentes.service")
const admins = require("../api/admins/admins.service")
const contratos = require("../api/contratos/contratos.service")

function conexionFalsa({ personaReferenciada }) {
  const consultas = []
  const conexion = {
    consultas,
    confirmaciones: 0,
    async beginTransaction() {},
    async commit() { conexion.confirmaciones++ },
    async rollback() {},
    release() {},
    async query(sql) { consultas.push(sql) },
    async execute(sql, parametros) {
      consultas.push(sql)
      if (sql.includes("FROM documentos WHERE")) return [[]]
      if (sql.startsWith("SELECT fotoPerfil")) return [[{ fotoPerfil: null }]]
      if (sql.startsWith("SELECT v.rutaArchivo")) return [[]]
      if (sql.startsWith("SELECT id FROM agentes")) return [[{ id: 7 }]]
      if (sql.startsWith("DELETE FROM personas") && personaReferenciada) {
        throw Object.assign(new Error("referenciada"), { code: "ER_ROW_IS_REFERENCED_2" })
      }
      if (sql.startsWith("SELECT") || sql.includes("FROM agentes a") || sql.includes("FROM usuarios u")) {
        return [[{ id: 8, idUsuario: 8, idPersona: 12, idInmobiliaria: 3 }]]
      }
      return [{ affectedRows: 1, parametros }]
    },
  }
  return conexion
}

for (const [nombre, eliminar] of [
  ["agente", () => agentes.eliminar({ rol: 1 }, 7)],
  ["admin", () => admins.eliminar(8)],
]) {
  test(`la baja de un ${nombre} con historial libera sus referencias y conserva la persona`, async (t) => {
    const conexion = conexionFalsa({ personaReferenciada: true })
    t.mock.method(db, "getConnection", async () => conexion)

    assert.equal(await eliminar(), true)
    assert.equal(conexion.confirmaciones, 1)
    const hizo = (texto) => conexion.consultas.some((sql) => sql.includes(texto))
    assert.ok(hizo("UPDATE versionesDocumentos SET idUsuarioAutor = NULL"))
    assert.ok(hizo("UPDATE propiedades SET idAgente = NULL"))
    assert.ok(hizo("UPDATE visitas SET idAgente = NULL"))
    assert.ok(hizo("DELETE FROM usuarios"))
    assert.ok(hizo("ROLLBACK TO SAVEPOINT baja_personal"))
    assert.ok(hizo("UPDATE personas SET dni = NULL, correo = NULL"))
  })

  test(`la baja de un ${nombre} sin historial borra la persona`, async (t) => {
    const conexion = conexionFalsa({ personaReferenciada: false })
    t.mock.method(db, "getConnection", async () => conexion)

    assert.equal(await eliminar(), true)
    assert.ok(conexion.consultas.some((sql) => sql.startsWith("RELEASE SAVEPOINT baja_personal")))
    assert.equal(conexion.consultas.some((sql) => sql.includes("UPDATE personas SET dni = NULL")), false)
  })
}

test("finaliza solo los contratos vigentes con fecha de fin anterior a hoy", async () => {
  let consulta
  const conexion = {
    async execute(sql, parametros) {
      consulta = { sql, parametros }
      return [{ affectedRows: 2 }]
    },
  }

  assert.equal(await contratos.finalizarVencidos("2026-11-18", conexion), 2)
  assert.match(consulta.sql, /actual\.nombre = 'Vigente'/)
  assert.match(consulta.sql, /finalizado\.nombre = 'Finalizado'/)
  assert.match(consulta.sql, /c\.fechaFin < \?/)
  assert.deepEqual(consulta.parametros, ["2026-11-18"])
})
