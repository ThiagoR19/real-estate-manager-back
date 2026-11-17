const test = require("node:test")
const assert = require("node:assert/strict")
const { readFileSync } = require("node:fs")
const { join } = require("node:path")

for (const variable of ["DB_HOST", "DB_USER", "DB_NAME", "TOKEN_SECRET", "FRONT_URL", "PORT"]) {
  process.env[variable] ||= "test"
}

const db = require("../db/conexion")
const agentes = require("../api/agentes/agentes.service")
const { falloError } = require("../utils/res")

const datos = {
  nombre: "Ana",
  apellido: "Pérez",
  dni: "12345678",
  correo: "ana@example.com",
  telefono: "1122334455",
  direccion: "Calle 1",
}

test("el esquema solo exige DNI y correo únicos como datos personales", () => {
  const esquema = readFileSync(join(__dirname, "../db/db.sql"), "utf8")
  const tabla = esquema.match(/CREATE TABLE IF NOT EXISTS `personas` \(([\s\S]*?)\) ENGINE=/)?.[1]
  assert.ok(tabla)
  const indices = [...tabla.matchAll(/UNIQUE KEY `([^`]+)` \(([^)]+)\)/g)]
    .filter(([, nombre]) => !["uq_Personas_tenant_id", "uq_Personas_id_namespace"].includes(nombre))
    .map(([, , columnas]) => columnas)
  assert.deepEqual(indices, ["`tenantClave`, `dni`", "`tenantClave`, `correo`"])
})

test("crear agente rechaza solo DNI o correo ya usados en su inmobiliaria", async (t) => {
  const consultas = []
  let duplicados = []
  let reversiones = 0
  let confirmaciones = 0
  const conexion = {
    async beginTransaction() {},
    async commit() { confirmaciones++ },
    async rollback() { reversiones++ },
    release() {},
    async execute(sql, parametros) {
      consultas.push({ sql, parametros })
      if (sql.includes("SELECT dni, correo")) return [duplicados]
      if (sql.includes("INSERT INTO personas")) return [{ insertId: 10 }]
      if (sql.includes("INSERT INTO usuarios")) return [{ insertId: 20 }]
      if (sql.includes("INSERT INTO agentes")) return [{ insertId: 30 }]
      if (sql.includes("INSERT INTO tokensAcceso")) return [{ insertId: 40 }]
      if (sql.includes("FROM usuarios u")) return [[{ id: 50, idPersona: 51 }]]
      if (sql.includes("FROM tiposNotificaciones")) return [[{ id: 2 }]]
      if (sql.includes("INSERT INTO notificaciones")) return [{ insertId: 60 }]
      if (sql.includes("INSERT INTO personasNotificaciones")) return [{ affectedRows: 1 }]
      throw new Error(`Consulta inesperada: ${sql}`)
    },
  }
  t.mock.method(db, "getConnection", async () => conexion)
  t.mock.method(db, "execute", async () => [[{ id: 30, idInmobiliaria: 4, ...datos }]])

  duplicados = [{ dni: datos.dni, correo: "otra@example.com" }]
  await assert.rejects(agentes.crear({ rol: 2, idInmobi: 4 }, datos), {
    codigo: "CONFLICTO",
    message: "El DNI ya está registrado en esta inmobiliaria",
  })
  assert.equal(consultas.some(({ sql }) => sql.includes("INSERT INTO personas")), false)

  duplicados = [{ dni: "87654321", correo: datos.correo }]
  await assert.rejects(agentes.crear({ rol: 2, idInmobi: 4 }, datos), {
    codigo: "CONFLICTO",
    message: "El correo ya está registrado en esta inmobiliaria",
  })
  assert.equal(consultas.some(({ sql }) => sql.includes("INSERT INTO personas")), false)

  // Coinciden nombre, teléfono y dirección con otra persona, pero no DNI ni correo.
  duplicados = []
  const resultado = await agentes.crear({ rol: 2, idInmobi: 4 }, datos)
  assert.equal(resultado.id, 30)
  assert.equal(confirmaciones, 1)
  assert.equal(reversiones, 2)
  assert.deepEqual(consultas.find(({ sql }) => sql.includes("SELECT dni, correo")).parametros,
    [4, datos.dni, datos.correo])
  assert.deepEqual(consultas.find(({ sql }) => sql.includes("INSERT INTO personas")).parametros,
    [4, datos.nombre, datos.apellido, datos.correo, datos.dni, datos.telefono, datos.direccion])
  assert.deepEqual(consultas.find(({ sql }) => sql.includes("FROM usuarios u")).parametros, [4, 0, 2])
  assert.deepEqual(consultas.find(({ sql }) => sql.includes("INSERT INTO personasNotificaciones")).parametros, [4, 60, 51])
})

test("un choque de índice por una creación simultánea identifica DNI o correo", () => {
  const original = console.error
  console.error = () => {}
  try {
    for (const [indice, mensaje] of [
      ["uq_Personas_1", "El DNI ya está registrado"],
      ["uq_Personas_2", "El correo ya está registrado"],
    ]) {
      const res = {
        status(codigo) { this.codigo = codigo; return this },
        json(cuerpo) { this.cuerpo = cuerpo; return this },
      }
      falloError(res, {
        code: "ER_DUP_ENTRY",
        sqlMessage: `Duplicate entry 'valor' for key 'personas.${indice}'`,
      })
      assert.equal(res.codigo, 409)
      assert.equal(res.cuerpo.error.mensaje, mensaje)
    }
  } finally {
    console.error = original
  }
})
