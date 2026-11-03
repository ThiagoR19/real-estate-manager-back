const crypto = require("crypto")

const HORAS_EXPIRACION = Number(process.env.ACTIVATION_TOKEN_HOURS) || 24

function crearTokenActivacion() {
  const codigo = crypto.randomBytes(32).toString("hex")
  const hash = crypto.createHash("sha256").update(codigo).digest("hex")
  const fechaExpiracion = new Date(Date.now() + HORAS_EXPIRACION * 60 * 60 * 1000)

  return { codigo, hash, fechaExpiracion }
}

function hashearToken(codigo) {
  return crypto.createHash("sha256").update(codigo).digest("hex")
}

function crearEnlaceActivacion(codigo) {
  const frontUrl = process.env.FRONT_URL

  if (!frontUrl || frontUrl === "*") return null

  return `${frontUrl.replace(/\/$/, "")}/activar?codigo=${encodeURIComponent(codigo)}`
}

module.exports = {
  crearTokenActivacion,
  hashearToken,
  crearEnlaceActivacion,
  HORAS_EXPIRACION,
}
