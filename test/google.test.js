const test = require("node:test")
const assert = require("node:assert/strict")
const crypto = require("node:crypto")
const { verificarGoogle } = require("../utils/google")

const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 })
const originalFetch = global.fetch
const originalAudience = process.env.GOOGLE_CLIENT_ID

process.env.GOOGLE_CLIENT_ID = "agi-test.apps.googleusercontent.com"
global.fetch = async () => ({
  ok: true,
  headers: { get: () => "public, max-age=300" },
  json: async () => ({ keys: [{ ...publicKey.export({ format: "jwk" }), kid: "test", use: "sig" }] }),
})

function token(cambios = {}) {
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "test" })).toString("base64url")
  const payload = Buffer.from(JSON.stringify({
    iss: "https://accounts.google.com", aud: process.env.GOOGLE_CLIENT_ID,
    exp: now + 300, iat: now, sub: "google-123", ...cambios,
  })).toString("base64url")
  const data = `${header}.${payload}`
  return `${data}.${crypto.sign("RSA-SHA256", Buffer.from(data), privateKey).toString("base64url")}`
}

test("acepta un token de Google con firma y claims válidos", async () => {
  assert.equal((await verificarGoogle(token())).sub, "google-123")
})

test("rechaza destinatario, vigencia y firma inválidos", async () => {
  await assert.rejects(verificarGoogle(token({ aud: "otra-app" })), { codigo: "CREDENCIALES_INVALIDAS" })
  await assert.rejects(verificarGoogle(token({ exp: 1 })), { codigo: "CREDENCIALES_INVALIDAS" })
  const alterado = token().split(".")
  alterado[1] = Buffer.from(JSON.stringify({ sub: "otro" })).toString("base64url")
  await assert.rejects(verificarGoogle(alterado.join(".")), { codigo: "CREDENCIALES_INVALIDAS" })
})

test.after(() => {
  global.fetch = originalFetch
  if (originalAudience === undefined) delete process.env.GOOGLE_CLIENT_ID
  else process.env.GOOGLE_CLIENT_ID = originalAudience
})
