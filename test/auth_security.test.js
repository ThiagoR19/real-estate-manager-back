const test = require("node:test")
const assert = require("node:assert/strict")
const bcrypt = require("bcrypt")
const jwt = require("jsonwebtoken")
const db = require("../db/conexion")
const { login, registrar } = require("../api/auth/auth.service")
const autenticar = require("../middlewares/autenticar")
const { crearTokenS } = require("../utils/token")
const { jwtSecret } = require("../config/env")

test("el login encuentra la cuenta correcta entre inmobiliarias con el mismo usuario", async (t) => {
  const cuentas = [
    { idUsuario: 11, usuario: "compartido", passwordHash: await bcrypt.hash("ClaveA123", 4),
      estado: "ACTIVO", idRol: 3, nombre: "Ana", apellido: "A", idInmobi: 1, inmobiliaria: "Uno" },
    { idUsuario: 22, usuario: "compartido", passwordHash: await bcrypt.hash("ClaveB123", 4),
      estado: "ACTIVO", idRol: 3, nombre: "Bea", apellido: "B", idInmobi: 2, inmobiliaria: "Dos" },
  ]
  t.mock.method(db, "execute", async (sql) => sql.includes("FROM usuarios u") ? [cuentas] : [{ affectedRows: 1 }])

  const resultado = await login({ usuario: "compartido", password: "ClaveB123" })
  assert.equal(resultado.usuario.id, 22)
  await assert.rejects(login({ usuario: "compartido", password: "incorrecta" }), { codigo: "CREDENCIALES_INVALIDAS" })
  await assert.rejects(login({ usuario: "compartido", password: "ClaveA123", idUsuario: 22 }), { codigo: "CREDENCIALES_INVALIDAS" })

  cuentas[0].passwordHash = cuentas[1].passwordHash
  const selector = await login({ usuario: "compartido", password: "ClaveB123" })
  assert.deepEqual(selector.cuentas, [
    { idUsuario: 11, inmobiliaria: "Uno" },
    { idUsuario: 22, inmobiliaria: "Dos" },
  ])
  assert.equal((await login({ usuario: "compartido", password: "ClaveB123", idUsuario: 22 })).usuario.id, 22)
  await assert.rejects(login({ usuario: "compartido", password: "ClaveB123", idUsuario: 99 }), { codigo: "CREDENCIALES_INVALIDAS" })
})

test("el registro comprueba duplicados solo dentro de la inmobiliaria", async (t) => {
  let parametrosDuplicado
  const conexion = {
    async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
    async execute(sql, parametros) {
      if (sql.includes("FROM tokensAcceso ta")) return [[{
        idToken: 9, idUsuario: 11, idRol: 3, nombre: "Ana", apellido: "A", idInmobi: 1,
      }]]
      if (sql.includes("SELECT id FROM usuarios WHERE usuario")) {
        parametrosDuplicado = parametros
        return [[]]
      }
      return [{ affectedRows: 1 }]
    },
  }
  t.mock.method(db, "getConnection", async () => conexion)
  t.mock.method(bcrypt, "hash", async () => "hash-de-prueba")
  const verificacion = jwt.sign({ tipo: "VerificacionDni", idUsuario: 11, tokenHash: "hash-token" }, jwtSecret)
  const resultado = await registrar({ verificacion, usuario: "compartido", password: "ClaveA123" })
  assert.deepEqual(parametrosDuplicado, ["compartido", 1, 11])
  assert.equal(resultado.usuario.id, 11)
})

test("el middleware invalida tokens de cuentas borradas o con rol o inmobiliaria cambiados", async (t) => {
  const token = crearTokenS("Ana", "A", 3, 11, 1)
  let cuenta = null
  t.mock.method(db, "execute", async (sql) => {
    if (sql.includes("sesionesRevocadas")) return [[]]
    if (sql.includes("FROM usuarios u")) return [cuenta ? [cuenta] : []]
    throw new Error("Consulta inesperada")
  })

  async function intentar() {
    const req = { headers: { authorization: `Bearer ${token}` } }
    const res = { status(codigo) { this.codigo = codigo; return this }, json(cuerpo) { this.cuerpo = cuerpo; return this } }
    let siguiente = false
    await autenticar(req, res, () => { siguiente = true })
    return { req, res, siguiente }
  }

  assert.equal((await intentar()).res.codigo, 401)
  cuenta = { idRol: 2, idInmobiliaria: 1, nombre: "Ana", apellido: "A" }
  assert.equal((await intentar()).res.codigo, 401)
  cuenta.idRol = 3
  cuenta.idInmobiliaria = 2
  assert.equal((await intentar()).res.codigo, 401)
  cuenta.idInmobiliaria = 1
  const vigente = await intentar()
  assert.equal(vigente.siguiente, true)
  assert.equal(vigente.req.usuario.id, 11)
})
