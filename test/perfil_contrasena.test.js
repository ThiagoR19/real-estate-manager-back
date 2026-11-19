const test = require("node:test")
const assert = require("node:assert/strict")
const crypto = require("node:crypto")
const { OAuth2Client } = require("google-auth-library")
const bcrypt = require("bcrypt")
const db = require("../db/conexion")
const { cambiarContrasena } = require("../api/perfil/perfil.service")
const { cambiarContrasenaSchema } = require("../api/perfil/perfil.schema")
const { login, loginGoogle } = require("../api/auth/auth.service")

test("una cuenta Google crea una contraseña y luego ingresa con ambos métodos", async (t) => {
  const cuenta = { passwordHash: null, googleSub: "google-123" }
  const usuario = () => ({
    idUsuario: 11, usuario: "ana", passwordHash: cuenta.passwordHash,
    estado: "ACTIVO", idRol: 3, nombre: "Ana", apellido: "A", idInmobi: 1,
  })
  t.mock.method(db, "execute", async (sql, parametros) => {
    if (sql.includes("SELECT u.passwordHash, u.googleSub")) return [[{ ...cuenta }]]
    if (sql.includes("UPDATE usuarios SET passwordHash")) {
      assert.equal(parametros[1], 11)
      assert.equal(parametros[2], cuenta.passwordHash)
      cuenta.passwordHash = parametros[0]
      return [{ affectedRows: 1 }]
    }
    if (sql.includes("WHERE u.googleSub = ?")) {
      assert.deepEqual(parametros, [cuenta.googleSub])
      return [[usuario()]]
    }
    if (sql.includes("FROM usuarios u")) return [[usuario()]]
    if (sql.includes("UPDATE usuarios SET ultimoAcceso")) return [{ affectedRows: 1 }]
    throw new Error(`Consulta inesperada: ${sql}`)
  })

  const primera = cambiarContrasenaSchema.parse({ actual: "", nueva: "ClaveNueva123", confirmacion: "ClaveNueva123" })
  assert.deepEqual(await cambiarContrasena(11, primera), {})
  assert.equal(cuenta.googleSub, "google-123")
  assert.equal((await login({ usuario: "ana", password: "ClaveNueva123" })).usuario.id, 11)

  assert.equal((await cambiarContrasena(11, { actual: "incorrecta", nueva: "OtraClave123" })).error, "DATOS_INVALIDOS")
  assert.deepEqual(await cambiarContrasena(11, { actual: "ClaveNueva123", nueva: "OtraClave123" }), {})
  assert.equal((await login({ usuario: "ana", password: "OtraClave123" })).usuario.id, 11)

  const audience = "agi-test.apps.googleusercontent.com"
  const anteriorAudience = process.env.GOOGLE_CLIENT_ID
  process.env.GOOGLE_CLIENT_ID = audience
  t.after(() => {
    if (anteriorAudience === undefined) delete process.env.GOOGLE_CLIENT_ID
    else process.env.GOOGLE_CLIENT_ID = anteriorAudience
  })
  const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 })
  t.mock.method(OAuth2Client.prototype, "getFederatedSignonCertsAsync", async () => ({
    certs: { "perfil-test": publicKey.export({ type: "spki", format: "pem" }) },
    format: "PEM",
  }))
  const ahora = Math.floor(Date.now() / 1000)
  const encabezado = Buffer.from(JSON.stringify({ alg: "RS256", kid: "perfil-test" })).toString("base64url")
  const cuerpo = Buffer.from(JSON.stringify({
    iss: "https://accounts.google.com", aud: audience, exp: ahora + 300, iat: ahora, sub: cuenta.googleSub,
  })).toString("base64url")
  const datos = `${encabezado}.${cuerpo}`
  const credential = `${datos}.${crypto.sign("RSA-SHA256", Buffer.from(datos), privateKey).toString("base64url")}`
  assert.equal((await loginGoogle({ credential })).usuario.id, 11)
})
