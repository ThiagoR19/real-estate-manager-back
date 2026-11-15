const crypto = require("crypto")
const db = require("../db/conexion")
const { verificarToken } = require("../utils/token")
const { fallo } = require("../utils/res")

async function validarSesion(token) {
  const datos = verificarToken(token)
  if (!datos || datos.tipo !== "Sesion") return null

  const tokenHash = crypto.createHash("sha256").update(token).digest("hex")
  const [revocaciones] = await db.execute(
    "SELECT 1 FROM sesionesRevocadas WHERE tokenHash = ? AND fechaExpiracion > CURRENT_TIMESTAMP LIMIT 1",
    [tokenHash]
  )
  if (revocaciones.length) return null

  const [cuentas] = await db.execute(
    `SELECT u.idRol, u.idInmobiliaria, p.nombre, p.apellido
     FROM usuarios u
     INNER JOIN personas p ON p.id = u.idPersona
       AND (p.idInmobiliaria <=> u.idInmobiliaria)
     WHERE u.id = ? AND u.fechaActivacion IS NOT NULL
     LIMIT 1`,
    [datos.id]
  )
  const cuenta = cuentas[0]
  if (!cuenta || cuenta.idRol !== datos.rol || cuenta.idInmobiliaria !== datos.idInmobi) return null

  return { ...datos, nombre: cuenta.nombre, apellido: cuenta.apellido }
}

async function autenticar(req, res, next) {
  const header = req.headers.authorization
  if (!header || !header.startsWith("Bearer ")) {
    return fallo(res, "TOKEN_FALTANTE")
  }

  const token = header.split(" ")[1]
  try {
    const usuario = await validarSesion(token)
    if (!usuario) return fallo(res, "TOKEN_INVALIDO")
    req.token = token
    req.usuario = usuario
    next()
  } catch (error) {
    next(error)
  }
}

module.exports = autenticar
module.exports.validarSesion = validarSesion
