const crypto = require("crypto")
const { frontURL, activationTokenHours } = require("../config/env")

const HORAS_EXPIRACION = activationTokenHours

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
  if (!frontURL || frontURL === "*") return null

  return `${frontURL.replace(/\/$/, "")}/activar?codigo=${encodeURIComponent(codigo)}`
}

module.exports = {
  crearTokenActivacion,
  hashearToken,
  crearEnlaceActivacion,
  HORAS_EXPIRACION,
}
