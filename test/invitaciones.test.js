const test = require("node:test")
const assert = require("node:assert/strict")
const crypto = require("node:crypto")
const bcrypt = require("bcrypt")

Object.assign(process.env, {
  DB_HOST: process.env.DB_HOST || "localhost",
  DB_USER: process.env.DB_USER || "test",
  DB_NAME: process.env.DB_NAME || "test",
  TOKEN_SECRET: process.env.TOKEN_SECRET || "test-secret-for-invitations",
  FRONT_URL: process.env.FRONT_URL || "http://localhost:5173",
  PORT: process.env.PORT || "3000",
})

const db = require("../db/conexion")
const auth = require("../api/auth/auth.service")
const { crearAgenteSchema } = require("../api/agentes/agentes.schema")
const { crearPropietarioSchema } = require("../api/propietarios/propietarios.schema")
const { crearInquilinoSchema } = require("../api/inquilinos/inquilinos.schema")
const { crearAdminSchema } = require("../api/admins/admins.schema")
const { registroSchema } = require("../api/auth/auth.schema")
const agents = require("../api/agentes/agentes.service")
const owners = require("../api/propietarios/propietarios.service")
const tenants = require("../api/inquilinos/inquilinos.service")
const admins = require("../api/admins/admins.service")
const profile = require("../api/perfil/perfil.service")
const { actualizarPerfilSchema } = require("../api/perfil/perfil.schema")

test("las cuatro altas aceptan solo DNI y rechazan credenciales previas", () => {
  for (const [schema, body] of [
    [crearAgenteSchema, { dni: "12345678" }],
    [crearPropietarioSchema, { dni: "12345678" }],
    [crearInquilinoSchema, { dni: "12345678" }],
    [crearAdminSchema, { idInmobiliaria: 1, dni: "12345678" }],
  ]) {
    assert.equal(schema.safeParse(body).success, true)
    assert.equal(schema.safeParse({ ...body, usuario: "anticipado", password: "secreto123" }).success, false)
    assert.equal(schema.safeParse({ ...body, dni: undefined }).success, false)
  }
  assert.equal(registroSchema.safeParse({ verificacion: "ticket", usuario: "titular", password: "Clave12345" }).success, true)
  assert.equal(registroSchema.safeParse({ codigo: "a".repeat(64), dni: "12345678", usuario: "titular", password: "Clave12345" }).success, false)
})

test("las cuatro altas guardan datos opcionales vacíos y credenciales pendientes", async () => {
  const originalGetConnection = db.getConnection
  const originalExecute = db.execute
  const dni = "12345678"
  const inserts = []
  const connection = {
    async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
    async execute(sql, params) {
      if (!sql.includes("INSERT INTO")) throw new Error(`Consulta inesperada: ${sql}`)
      inserts.push({ sql, params })
      return [{ insertId: inserts.length }]
    },
  }
  db.getConnection = async () => connection
  db.execute = async () => [[{ id: 1, dni }]]
  try {
    for (const create of [
      () => agents.crear({ rol: 2, idInmobi: 3 }, { dni }),
      () => owners.crear({ rol: 2, idInmobi: 3 }, { dni }),
      () => tenants.crear({ rol: 2, idInmobi: 3 }, { dni }),
      () => admins.crear({ idInmobiliaria: 3, dni }),
    ]) {
      inserts.length = 0
      const result = await create()
      assert.ok(result.activacion.enlace.includes("/activar?codigo="))
      const person = inserts.find((entry) => entry.sql.includes("INSERT INTO personas"))
      const account = inserts.find((entry) => entry.sql.includes("INSERT INTO usuarios"))
      assert.deepEqual(person.params, [3, null, null, null, dni, null, null])
      assert.equal(account.sql.includes("passwordHash"), false)
      assert.equal(account.sql.includes("usuario,"), false)
      assert.equal(account.params.length, 3)
    }
  } finally {
    db.getConnection = originalGetConnection
    db.execute = originalExecute
  }
})

test("admin, agente, propietario e inquilino completan sus datos personales desde el perfil", async () => {
  const original = db.execute
  let role = 3
  let updated = null
  db.execute = async (sql, params) => {
    if (sql.includes("SELECT") && sql.includes("FROM usuarios u")) {
      return [[{ id: 9, idPersona: 10, idRol: role, nombre: null, apellido: null, correo: null, telefono: null, direccion: null, dni: "12345678" }]]
    }
    if (sql.includes("UPDATE personas SET")) { updated = { sql, params }; return [{}] }
    throw new Error(`Consulta inesperada: ${sql}`)
  }
  try {
    const changes = { nombre: "Ana", apellido: "Pérez", correo: "ana@example.com", telefono: "+541112345678", direccion: "Calle 123" }
    assert.equal(actualizarPerfilSchema.safeParse(changes).success, true)
    assert.equal(actualizarPerfilSchema.safeParse({ dni: "87654321" }).success, false)
    for (role of [2, 3, 4, 5]) {
      updated = null
      const result = await profile.actualizar(9, changes)
      assert.ok(result.perfil)
      assert.ok(updated.sql.includes("nombre = ?"))
      assert.ok(updated.sql.includes("apellido = ?"))
      assert.ok(updated.sql.includes("correo = ?"))
      assert.deepEqual(updated.params, ["Ana", "Pérez", "+541112345678", "ana@example.com", "Calle 123", 10])
    }
  } finally { db.execute = original }
})

test("el DNI se verifica antes de crear usuario y contraseña; el enlace se consume", async () => {
  const original = db.getConnection
  const codigo = "a".repeat(64)
  const state = {
    hash: crypto.createHash("sha256").update(codigo).digest("hex"),
    dni: "12345678", intentos: 0, usado: false, activo: false,
    usuario: null, passwordHash: null,
  }
  const connection = {
    async beginTransaction() {}, async commit() {}, async rollback() {}, release() {},
    async execute(sql, params) {
      if (sql.includes("SELECT ta.id AS idToken, ta.intentosDni")) {
        return [[!state.usado && !state.activo && params[0] === state.hash
          ? { idToken: 7, intentosDni: state.intentos, idUsuario: 9, dni: state.dni } : null].filter(Boolean)]
      }
      if (sql.includes("SELECT ta.id AS idToken, u.id AS idUsuario")) {
        return [[!state.usado && !state.activo && state.intentos < 3 && params[0] === state.hash && params[1] === 9
          ? { idToken: 7, idUsuario: 9, idRol: 5, nombre: null, apellido: null, idInmobi: 2 } : null].filter(Boolean)]
      }
      if (sql.includes("SELECT id FROM usuarios WHERE usuario")) return [[]]
      if (sql.includes("SET intentosDni")) {
        state.intentos = params[0]
        if (state.intentos >= 3) state.usado = true
        return [{}]
      }
      if (sql.includes("UPDATE usuarios SET usuario")) {
        state.usuario = params[0]
        state.passwordHash = params[1]
        state.activo = true
        return [{}]
      }
      if (sql.includes("UPDATE tokensAcceso SET fechaUso")) { state.usado = true; return [{}] }
      throw new Error(`Consulta inesperada: ${sql}`)
    },
  }
  db.getConnection = async () => connection
  try {
    assert.equal((await auth.registrar({ verificacion: "inventada", usuario: "titular", password: "Clave12345" })).error, "INVITACION_INVALIDA")
    assert.equal((await auth.verificarDni(codigo, "87654321")).error, "DATOS_INVALIDOS")
    assert.equal(state.intentos, 1)
    const { verificacion } = await auth.verificarDni(codigo, "12345678")
    assert.ok(verificacion)
    assert.equal(state.activo, false)
    const result = await auth.registrar({ verificacion, usuario: "titular", password: "Clave12345" })
    assert.equal(result.usuario.usuario, "titular")
    assert.equal(state.activo, true)
    assert.equal(await bcrypt.compare("Clave12345", state.passwordHash), true)
    assert.equal((await auth.registrar({ verificacion, usuario: "otra", password: "Clave12345" })).error, "INVITACION_INVALIDA")
    state.usado = false
    state.activo = false
    state.intentos = 0
    for (let attempt = 0; attempt < 3; attempt++) {
      assert.equal((await auth.verificarDni(codigo, "87654321")).error, "DATOS_INVALIDOS")
    }
    assert.equal(state.usado, true)
    assert.equal((await auth.verificarDni(codigo, "12345678")).error, "INVITACION_INVALIDA")
  } finally { db.getConnection = original }
})
