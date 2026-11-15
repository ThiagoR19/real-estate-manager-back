const test = require("node:test")
const assert = require("node:assert/strict")

for (const variable of ["DB_HOST", "DB_USER", "DB_NAME", "TOKEN_SECRET", "FRONT_URL", "PORT"]) {
  process.env[variable] ||= "test"
}

const { falloError } = require("../utils/res")

function respuesta() {
  return {
    status(code) { this.code = code; return this },
    json(body) { this.body = body; return this },
  }
}

test("los errores de datos y referencias usan códigos HTTP de cliente", () => {
  const original = console.error
  console.error = () => {}
  try {
    for (const [code, http, codigo] of [
      ["ER_DUP_ENTRY", 409, "CONFLICTO"],
      ["ER_NO_REFERENCED_ROW_2", 404, "NO_ENCONTRADO"],
      ["ER_ROW_IS_REFERENCED_2", 409, "CONFLICTO"],
      ["ER_BAD_NULL_ERROR", 400, "DATOS_INVALIDOS"],
      ["ER_TRUNCATED_WRONG_VALUE", 400, "DATOS_INVALIDOS"],
    ]) {
      const res = respuesta()
      falloError(res, Object.assign(new Error("fallo de base"), { code }))
      assert.equal(res.code, http, code)
      assert.equal(res.body.error.codigo, codigo, code)
    }
  } finally {
    console.error = original
  }
})

test("los controladores devuelven 404 cuando el servicio no encuentra el recurso", async () => {
  const casos = [
    ["agentes", "obtener", "buscarPorId", null],
    ["agentes", "actualizar", "actualizar", null],
    ["inquilinos", "obtener", "buscarPorId", null],
    ["inquilinos", "actualizar", "actualizar", null],
    ["inquilinos", "eliminar", "eliminar", false],
    ["propietarios", "actualizar", "actualizar", null],
    ["propietarios", "eliminar", "eliminar", false],
    ["profesionales", "actualizar", "actualizar", null],
    ["profesionales", "eliminar", "eliminar", false],
    ["reportes", "obtenerPorId", "buscarPorId", null],
    ["reportes", "actualizar", "actualizar", null],
    ["reportes", "eliminar", "eliminar", false],
    ["admins", "eliminar", "eliminar", false],
    ["admins", "pasarAAgente", "pasarAAgente", null],
    ["notificaciones", "actualizar", "actualizar", false],
  ]

  for (const [modulo, accion, metodo, resultado] of casos) {
    const service = require(`../api/${modulo}/${modulo}.service`)
    const controller = require(`../api/${modulo}/${modulo}.controller`)
    const original = service[metodo]
    service[metodo] = async () => resultado
    try {
      const res = respuesta()
      const body = modulo === "reportes" ? { titulo: "Prueba" } : { nombre: "Prueba" }
      await controller[accion]({ usuario: { id: 1, idInmobi: 1 }, params: { id: "999999" }, body }, res)
      assert.equal(res.code, 404, `${modulo}.${accion}`)
      assert.equal(res.body.error.codigo, "NO_ENCONTRADO", `${modulo}.${accion}`)
    } finally {
      service[metodo] = original
    }
  }
})
