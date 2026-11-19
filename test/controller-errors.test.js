const test = require("node:test")
const assert = require("node:assert/strict")

for (const variable of ["DB_HOST", "DB_USER", "DB_NAME", "TOKEN_SECRET", "FRONT_URL", "PORT"]) {
  process.env[variable] ||= "test"
}

const { fallo, falloError, problema, ERRORES } = require("../utils/res")

function respuesta() {
  return {
    status(code) { this.code = code; return this },
    json(body) { this.body = body; return this },
  }
}

test("fallo usa el error interno para un código desconocido", () => {
  const res = respuesta()
  fallo(res, "CODIGO_INEXISTENTE")
  assert.equal(res.code, 500)
  assert.deepEqual(res.body, {
    status: "error",
    error: { codigo: "ERROR_INTERNO", mensaje: ERRORES.ERROR_INTERNO.mensaje },
  })
})

test("el manejador central conserva el mensaje y los detalles de validación", (t) => {
  t.mock.method(console, "error", () => {})
  const res = respuesta()
  const error = problema("DATOS_INVALIDOS", "El archivo no es válido")
  error.detalles = [{ campo: "archivo", problema: "Formato no admitido" }]
  falloError(res, error)
  assert.equal(res.code, 400)
  assert.deepEqual(res.body.error, {
    codigo: "DATOS_INVALIDOS", mensaje: error.message, detalles: error.detalles,
  })
})

test("el acceso con Google responde con los errores definidos en res.js", async (t) => {
  const service = require("../api/auth/auth.service")
  const controller = require("../api/auth/auth.controller")
  for (const [codigo, http] of [
    ["GOOGLE_TOKEN_INVALIDO", 401],
    ["GOOGLE_NO_CONFIGURADO", 500],
    ["GOOGLE_NO_DISPONIBLE", 503],
  ]) {
    t.mock.method(service, "loginGoogle", async () => { throw problema(codigo) })
    const res = respuesta()
    await controller.loginGoogle({ body: { credential: "token-de-prueba" } }, res)
    assert.equal(res.code, http)
    assert.deepEqual(res.body, {
      status: http >= 500 ? "error" : "fail",
      error: { codigo, mensaje: ERRORES[codigo].mensaje },
    })
  }
})

test("los errores de archivos conservan el mensaje y los detalles al usar fallo", async (t) => {
  const service = require("../api/agentes/agentes.service")
  const controller = require("../api/agentes/agentes.controller")
  const error = problema("DATOS_INVALIDOS", "La foto tiene un formato incorrecto")
  error.detalles = [{ campo: "fotoPerfil", problema: "Debe ser una imagen" }]
  t.mock.method(service, "cargarFoto", async () => { throw error })

  const res = respuesta()
  await controller.cargarFoto({}, res, () => { assert.fail("Debe responder usando fallo") })
  assert.equal(res.code, 400)
  assert.deepEqual(res.body.error, {
    codigo: "DATOS_INVALIDOS", mensaje: error.message, detalles: error.detalles,
  })
})

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
