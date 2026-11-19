require("dotenv/config")

const { OAuth2Client } = require("google-auth-library")
const { problema } = require("./res")

const clienteGoogle = new OAuth2Client()
const TOLERANCIA_EMISION_SEGUNDOS = 60

async function verificarGoogle(credential) {
  const idCliente = process.env.GOOGLE_CLIENT_ID
  if (!idCliente) throw problema("GOOGLE_NO_CONFIGURADO")

  try {
    const resultado = await clienteGoogle.verifyIdToken({
      idToken: credential,
      audience: idCliente,
    })
    const contenido = resultado.getPayload()
    if (typeof contenido?.sub !== "string" || !contenido.sub) throw problema("GOOGLE_TOKEN_INVALIDO")

    const ahora = Math.floor(Date.now() / 1000)
    if (!Number.isInteger(contenido.exp) || contenido.exp <= ahora) throw problema("GOOGLE_TOKEN_INVALIDO")
    if (!Number.isInteger(contenido.iat) || contenido.iat > ahora + TOLERANCIA_EMISION_SEGUNDOS) throw problema("GOOGLE_TOKEN_INVALIDO")

    return contenido
  } catch (error) {
    if (error.codigo) throw error
    if (error.response || error.name === "GaxiosError") throw problema("GOOGLE_NO_DISPONIBLE")
    throw problema("GOOGLE_TOKEN_INVALIDO")
  }
}

module.exports = { verificarGoogle }
