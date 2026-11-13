const test = require("node:test")
const assert = require("node:assert/strict")

Object.assign(process.env, {
  DB_HOST: process.env.DB_HOST || "localhost",
  DB_USER: process.env.DB_USER || "test",
  DB_NAME: process.env.DB_NAME || "test",
})

const db = require("../db/conexion")
const service = require("../api/areas/areas.service")
const { ADMIN, SUPERADMIN } = require("../config/roles")

test("las ciudades de un administrador se limitan a su inmobiliaria", async () => {
  const original = db.execute
  try {
    db.execute = async (sql, parameters) => {
      assert.match(sql, /WHERE idInmobiliaria = \?/)
      assert.deepEqual(parameters, [7])
      return [[{ id: 3, idInmobiliaria: 7, nombre: "La Plata" }]]
    }
    const result = await service.listar({ rol: ADMIN, idInmobi: 7 }, 12)
    assert.deepEqual(result, [{ id: 3, idInmobiliaria: 7, nombre: "La Plata" }])
  } finally {
    db.execute = original
  }
})

test("un superadministrador puede consultar una inmobiliaria concreta", async () => {
  const original = db.execute
  try {
    db.execute = async (sql, parameters) => {
      assert.match(sql, /WHERE idInmobiliaria = \?/)
      assert.deepEqual(parameters, [12])
      return [[]]
    }
    assert.deepEqual(await service.listar({ rol: SUPERADMIN }, 12), [])
  } finally {
    db.execute = original
  }
})
