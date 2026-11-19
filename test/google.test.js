const test = require("node:test")
const assert = require("node:assert/strict")
const crypto = require("node:crypto")
const { OAuth2Client } = require("google-auth-library")
const { verificarGoogle } = require("../utils/google")

const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 })
const originalAudience = process.env.GOOGLE_CLIENT_ID

process.env.GOOGLE_CLIENT_ID = "agi-test.apps.googleusercontent.com"
test.beforeEach((t) => {
  t.mock.method(OAuth2Client.prototype, "getFederatedSignonCertsAsync", async () => ({
    certs: { test: publicKey.export({ type: "spki", format: "pem" }) },
    format: "PEM",
  }))
})

function token(cambios = {}, cambiosEncabezado = {}) {
  const now = Math.floor(Date.now() / 1000)
  const header = Buffer.from(JSON.stringify({ alg: "RS256", kid: "test", ...cambiosEncabezado })).toString("base64url")
  const payload = Buffer.from(JSON.stringify({
    iss: "https://accounts.google.com", aud: process.env.GOOGLE_CLIENT_ID,
    exp: now + 300, iat: now, sub: "google-123", ...cambios,
  })).toString("base64url")
  const data = `${header}.${payload}`
  if (cambiosEncabezado.alg === "HS256") {
    return `${data}.${crypto.createHmac("sha256", "clave-de-prueba").update(data).digest("base64url")}`
  }
  return `${data}.${crypto.sign("RSA-SHA256", Buffer.from(data), privateKey).toString("base64url")}`
}

test("verifica el token con la biblioteca oficial y el ID de cliente configurado", async (t) => {
  const verificar = t.mock.method(OAuth2Client.prototype, "verifyIdToken")
  const credential = token({ email: "ana@example.com", email_verified: true })
  const contenido = await verificarGoogle(credential)
  assert.deepEqual(verificar.mock.calls[0].arguments, [{
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  }])
  assert.equal(contenido.sub, "google-123")
  assert.equal(contenido.email, "ana@example.com")
  assert.equal(contenido.email_verified, true)
})

test("rechaza destinatario, vigencia y firma inválidos", async () => {
  await assert.rejects(verificarGoogle(token({ aud: "otra-app" })), { codigo: "GOOGLE_TOKEN_INVALIDO" })
  await assert.rejects(verificarGoogle(token({ exp: 1 })), { codigo: "GOOGLE_TOKEN_INVALIDO" })
  const alterado = token().split(".")
  alterado[1] = Buffer.from(JSON.stringify({ sub: "otro" })).toString("base64url")
  await assert.rejects(verificarGoogle(alterado.join(".")), { codigo: "GOOGLE_TOKEN_INVALIDO" })
})

test("rechaza un emisor, fecha de emisión o identificador de usuario inválidos", async () => {
  const ahora = Math.floor(Date.now() / 1000)
  const casos = [
    { iss: "https://otro-emisor.com" },
    { iat: ahora + 3600 },
    { iat: undefined },
    { iat: "123" },
    { exp: String(ahora + 300) },
    { exp: undefined },
    { sub: "" },
    { sub: 123 },
  ]
  for (const cambios of casos) {
    await assert.rejects(verificarGoogle(token(cambios)), { codigo: "GOOGLE_TOKEN_INVALIDO" })
  }
})

test("acepta ambos emisores de Google y la tolerancia de emisión", async () => {
  const iat = Math.floor(Date.now() / 1000) + 60
  for (const iss of ["accounts.google.com", "https://accounts.google.com"]) {
    const contenido = await verificarGoogle(token({ iss, iat }))
    assert.equal(contenido.iss, iss)
    assert.equal(contenido.iat, iat)
  }
})

test("rechaza credenciales malformadas y encabezados no admitidos", async () => {
  for (const credential of [null, "", "sin.puntos", "no.es.json", token({}, { alg: "HS256" }), token({}, { kid: 123 })]) {
    await assert.rejects(verificarGoogle(credential), { codigo: "GOOGLE_TOKEN_INVALIDO" })
  }
})

test("rechaza un token cuya clave de firma no es reconocida por Google", async () => {
  await assert.rejects(verificarGoogle(token({}, { kid: "desconocida" })), { codigo: "GOOGLE_TOKEN_INVALIDO" })
})

test("devuelve un error de servicio cuando Google no está disponible", async (t) => {
  const error = Object.assign(new Error("Google no está disponible"), { response: { status: 503 } })
  t.mock.method(OAuth2Client.prototype, "getFederatedSignonCertsAsync", async () => { throw error })
  await assert.rejects(verificarGoogle(token()), { codigo: "GOOGLE_NO_DISPONIBLE" })
})

test("un error de red de Google se informa como servicio no disponible", async (t) => {
  const error = Object.assign(new Error("Detalles internos de red"), { name: "GaxiosError" })
  t.mock.method(OAuth2Client.prototype, "getFederatedSignonCertsAsync", async () => { throw error })
  await assert.rejects(verificarGoogle(token()), {
    codigo: "GOOGLE_NO_DISPONIBLE",
    message: "No se pudo verificar la cuenta con Google. Intentá nuevamente en unos minutos.",
  })
})

test("conserva el rechazo inmediato al vencer el token y el límite de emisión de 60 segundos", async () => {
  const ahora = Math.floor(Date.now() / 1000)
  for (const cambios of [{ exp: ahora - 1 }, { iat: ahora + 120 }]) {
    await assert.rejects(verificarGoogle(token(cambios)), { codigo: "GOOGLE_TOKEN_INVALIDO" })
  }
})

test("informa la falta de configuración de Google sin intentar verificar tokens", async (t) => {
  const verificar = t.mock.method(OAuth2Client.prototype, "verifyIdToken", async () => {
    throw new Error("No debe intentar verificar sin el ID de cliente")
  })
  const idCliente = process.env.GOOGLE_CLIENT_ID
  delete process.env.GOOGLE_CLIENT_ID
  try {
    await assert.rejects(verificarGoogle(token()), { codigo: "GOOGLE_NO_CONFIGURADO" })
    assert.equal(verificar.mock.callCount(), 0)
  } finally {
    process.env.GOOGLE_CLIENT_ID = idCliente
  }
})

test.after(() => {
  if (originalAudience === undefined) delete process.env.GOOGLE_CLIENT_ID
  else process.env.GOOGLE_CLIENT_ID = originalAudience
})
