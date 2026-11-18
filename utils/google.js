require("dotenv/config")

const crypto = require("crypto")

let claves = new Map()
let vencimientoClaves = 0

function errorGoogle() {
  const error = new Error("La autenticación con Google expiró o no es válida")
  error.codigo = "CREDENCIALES_INVALIDAS"
  return error
}

function decodificar(segmento) {
  return JSON.parse(Buffer.from(segmento, "base64url").toString("utf8"))
}

async function clavePublica(kid) {
  if (Date.now() >= vencimientoClaves || !claves.has(kid)) {
    const respuesta = await fetch("https://www.googleapis.com/oauth2/v3/certs")
    if (!respuesta.ok) throw new Error("No se pudieron obtener las claves públicas de Google")
    const jwks = await respuesta.json()
    claves = new Map((jwks.keys || []).filter((key) => key.kty === "RSA" && key.use === "sig")
      .map((key) => [key.kid, crypto.createPublicKey({ key, format: "jwk" })]))
    const maxAge = Number(respuesta.headers.get("cache-control")?.match(/max-age=(\d+)/)?.[1] || 300)
    vencimientoClaves = Date.now() + Math.min(maxAge, 86400) * 1000
  }
  return claves.get(kid)
}

async function verificarGoogle(credential) {
  const audience = process.env.GOOGLE_CLIENT_ID
  if (!audience) {
    const error = new Error("Google no está configurado en el servidor")
    error.codigo = "ERROR_INTERNO"
    throw error
  }
  try {
    const partes = credential.split(".")
    if (partes.length !== 3) throw errorGoogle()
    const [encabezado, cuerpo, firma] = partes
    const header = decodificar(encabezado)
    if (header.alg !== "RS256" || typeof header.kid !== "string") throw errorGoogle()
    const clave = await clavePublica(header.kid)
    if (!clave || !crypto.verify("RSA-SHA256", Buffer.from(`${encabezado}.${cuerpo}`), clave, Buffer.from(firma, "base64url"))) {
      throw errorGoogle()
    }
    const payload = decodificar(cuerpo)
    const ahora = Math.floor(Date.now() / 1000)
    if (!(["accounts.google.com", "https://accounts.google.com"].includes(payload.iss)) ||
        payload.aud !== audience || !Number.isInteger(payload.exp) || payload.exp <= ahora ||
        !Number.isInteger(payload.iat) || payload.iat > ahora + 60 ||
        typeof payload.sub !== "string" || !payload.sub) throw errorGoogle()
    return payload
  } catch (error) {
    if (error.codigo) throw error
    if (error.message === "No se pudieron obtener las claves públicas de Google") throw error
    throw errorGoogle()
  }
}

module.exports = { verificarGoogle }
