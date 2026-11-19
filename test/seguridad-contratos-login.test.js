const test = require("node:test")
const assert = require("node:assert/strict")
const { EventEmitter } = require("node:events")

for (const variable of ["DB_HOST", "DB_USER", "DB_NAME", "TOKEN_SECRET", "FRONT_URL", "PORT"]) {
  process.env[variable] ||= "test"
}

const db = require("../db/conexion")
const contratos = require("../api/contratos/contratos.service")
const { limitarIntentos } = require("../middlewares/limitarIntentos")

function conexionContrato(personas) {
  const consultas = []
  return {
    consultas,
    async beginTransaction() {},
    async commit() {},
    async rollback() {},
    release() {},
    async execute(sql) {
      consultas.push(sql)
      if (sql.includes("FROM propiedades p WHERE")) return [[{ id: 1 }]]
      if (sql.includes("FROM personas per")) return [personas]
      throw new Error(`Consulta inesperada: ${sql}`)
    },
  }
}

const alquiler = {
  idPropiedad: 1,
  tipo: "Alquiler",
  estado: "Vigente",
  participantes: [{ idPersona: 10, rol: "Propietario" }, { idPersona: 20, rol: "Inquilino" }],
}

test("un alquiler con personal como propietario o inquilino se rechaza sin insertar", async (t) => {
  const conexion = conexionContrato([
    { id: 10, esPropietario: 0, esInquilino: 0, esPersonal: 1 },
    { id: 20, esPropietario: 0, esInquilino: 0, esPersonal: 1 },
  ])
  t.mock.method(db, "getConnection", async () => conexion)

  const resultado = await contratos.crear({ idInmobi: 2, id: 1 }, alquiler)
  assert.equal(resultado.error, "DATOS_INVALIDOS")
  assert.equal(resultado.detalles.length, 2)
  assert.equal(conexion.consultas.some((sql) => sql.includes("INSERT INTO contratos")), false)
})

test("los participantes con su rol real pasan la validación", async (t) => {
  const conexion = conexionContrato([
    { id: 10, esPropietario: 1, esInquilino: 0, esPersonal: 0 },
    { id: 20, esPropietario: 0, esInquilino: 1, esPersonal: 0 },
  ])
  t.mock.method(db, "getConnection", async () => conexion)

  await assert.rejects(contratos.crear({ idInmobi: 2, id: 1 }, alquiler), /Consulta inesperada/)
  assert.ok(conexion.consultas.some((sql) => sql.includes("FROM personas per")))
})

function pedir(middleware, estado) {
  const res = new EventEmitter()
  res.statusCode = estado
  res.headers = {}
  res.set = (nombre, valor) => { res.headers[nombre] = valor }
  res.status = (codigo) => { res.statusCode = codigo; return res }
  res.json = () => res
  let siguio = false
  middleware({ ip: "1.2.3.4" }, res, () => { siguio = true })
  if (siguio) res.emit("finish")
  return { siguio, res }
}

test("el limitador corta con 429 después de los intentos fallidos permitidos", () => {
  const limitar = limitarIntentos({ maximo: 3, ventanaMs: 60000 })
  for (let i = 0; i < 3; i++) assert.equal(pedir(limitar, 401).siguio, true)
  const bloqueado = pedir(limitar, 401)
  assert.equal(bloqueado.siguio, false)
  assert.equal(bloqueado.res.statusCode, 429)
  assert.ok(Number(bloqueado.res.headers["Retry-After"]) > 0)
})

test("las respuestas exitosas no consumen intentos", () => {
  const limitar = limitarIntentos({ maximo: 2, ventanaMs: 60000 })
  for (let i = 0; i < 5; i++) assert.equal(pedir(limitar, 200).siguio, true)
})
